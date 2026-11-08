import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { toast } from "sonner";
import { getFirebase } from "./firebase";
import { clearLastProfileId } from "./profiles";
import type { PermissionKey } from "./permissions";
import type { UserProfile, RoleDoc } from "./members";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes of inactivity

export type AuthStatus = "loading" | "signedOut" | "noProfile" | "disabled" | "ready";

export interface UserContextValue {
  name: string;
  email: string;
  role: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: User | null;
  profile: UserProfile | null;
  role: RoleDoc | null;
  user: UserContextValue | null;
  ready: boolean;
  isAdmin: boolean;
  can: (permission: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  requestAccess: () => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<RoleDoc | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const roleUnsubRef = useRef<Unsubscribe | null>(null);
  const profileUnsubRef = useRef<Unsubscribe | null>(null);

  const logout = useCallback(async (isTimeout = false) => {
    try {
      localStorage.removeItem("farg_publisher_map_v1");
      sessionStorage.clear();
    } catch {
      /* ignore */
    }

    if (roleUnsubRef.current) {
      roleUnsubRef.current();
      roleUnsubRef.current = null;
    }
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }

    const fb = getFirebase();
    if (fb) {
      try {
        const { signOut } = await import("firebase/auth");
        await signOut(fb.auth);
      } catch {
        /* ignore */
      }
    }

    setFirebaseUser(null);
    setProfile(null);
    setRole(null);
    clearLastProfileId();
    setStatus("signedOut");

    if (isTimeout) {
      toast.info("Signed out due to 60 minutes of inactivity.");
    }
  }, []);

  // Idle timeout activity tracker
  useEffect(() => {
    if (status !== "ready") return;

    let throttleTimer: number | null = null;
    const updateActivity = () => {
      if (throttleTimer) return;
      throttleTimer = window.setTimeout(() => {
        lastActivityRef.current = Date.now();
        throttleTimer = null;
      }, 1000);
    };

    const events = ["mousemove", "keydown", "click", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));

    const checkInterval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        void logout(true);
      }
    }, 30_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
      window.clearInterval(checkInterval);
      if (throttleTimer) window.clearTimeout(throttleTimer);
    };
  }, [status, logout]);

  // Firebase auth state listener
  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setStatus("signedOut");
      return;
    }

    let authUnsub: (() => void) | null = null;

    import("firebase/auth").then(({ onAuthStateChanged }) => {
      authUnsub = onAuthStateChanged(fb.auth, (authUser) => {
        // Clean up any existing Firestore subscriptions
        if (roleUnsubRef.current) {
          roleUnsubRef.current();
          roleUnsubRef.current = null;
        }
        if (profileUnsubRef.current) {
          profileUnsubRef.current();
          profileUnsubRef.current = null;
        }

        if (!authUser) {
          setFirebaseUser(null);
          setProfile(null);
          setRole(null);
          setStatus("signedOut");
          return;
        }

        setFirebaseUser(authUser);
        setStatus("loading");

        // Subscribe to user profile
        profileUnsubRef.current = onSnapshot(
          doc(fb.db, "users", authUser.uid),
          (userSnap) => {
            if (!userSnap.exists()) {
              if (roleUnsubRef.current) {
                roleUnsubRef.current();
                roleUnsubRef.current = null;
              }
              setProfile(null);
              setRole(null);
              setStatus("noProfile");
              return;
            }

            const userData = userSnap.data();
            const prof: UserProfile = {
              uid: userSnap.id,
              email: userData.email || authUser.email || "",
              displayName: userData.displayName || authUser.displayName || "",
              role: userData.role || "analyst",
              status: userData.status || "active",
              createdAt: userData.createdAt || null,
              createdBy: userData.createdBy || "",
              updatedAt: userData.updatedAt || null,
              updatedBy: userData.updatedBy || "",
            };

            setProfile(prof);

            if (prof.status !== "active") {
              if (roleUnsubRef.current) {
                roleUnsubRef.current();
                roleUnsubRef.current = null;
              }
              setRole(null);
              setStatus("disabled");
              return;
            }

            if (prof.role === "admin") {
              if (roleUnsubRef.current) {
                roleUnsubRef.current();
                roleUnsubRef.current = null;
              }
              setRole({
                id: "admin",
                name: "Administrator",
                description: "Full system administrator",
                system: true,
                permissions: {} as Record<string, boolean>,
                updatedAt: null,
                updatedBy: "",
              });
              setStatus("ready");
              return;
            }

            // Subscribe to custom/analyst role
            if (roleUnsubRef.current) {
              roleUnsubRef.current();
            }

            roleUnsubRef.current = onSnapshot(
              doc(fb.db, "roles", prof.role),
              (roleSnap) => {
                if (roleSnap.exists()) {
                  const rData = roleSnap.data();
                  setRole({
                    id: roleSnap.id,
                    name: rData.name || roleSnap.id,
                    description: rData.description || "",
                    system: !!rData.system,
                    permissions: (rData.permissions as Record<string, boolean>) || {},
                    updatedAt: rData.updatedAt || null,
                    updatedBy: rData.updatedBy || "",
                  });
                } else {
                  setRole(null);
                }
                setStatus("ready");
              },
              () => {
                setRole(null);
                setStatus("ready");
              },
            );
          },
          () => {
            setProfile(null);
            setRole(null);
            setStatus("noProfile");
          },
        );
      });
    });

    return () => {
      if (authUnsub) authUnsub();
      if (profileUnsubRef.current) profileUnsubRef.current();
      if (roleUnsubRef.current) roleUnsubRef.current();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const fb = getFirebase();
    if (!fb) return { ok: false, error: "Firebase unavailable." };
    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(fb.auth, email.trim().toLowerCase(), password);
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-email"
      ) {
        return { ok: false, error: "Invalid email or password." };
      }
      if (code === "auth/too-many-requests") {
        return {
          ok: false,
          error: "Too many attempts. Wait a few minutes or reset your password.",
        };
      }
      if (code === "auth/user-disabled") {
        return { ok: false, error: "This account has been disabled." };
      }
      if (code === "auth/network-request-failed") {
        return { ok: false, error: "Network error. Check your connection." };
      }
      return { ok: false, error: "Invalid email or password." };
    }
  };

  const sendPasswordReset = async (email: string) => {
    const fb = getFirebase();
    if (!fb) return { ok: false, message: "Firebase unavailable." };
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(fb.auth, email.trim().toLowerCase());
    } catch {
      /* Always return generic success message to prevent account enumeration */
    }
    return {
      ok: true,
      message: "If an account exists with that email, a password reset link has been sent.",
    };
  };

  const requestAccess = async () => {
    const fb = getFirebase();
    if (!fb || !fb.auth.currentUser) return { ok: false, error: "Not authenticated" };
    const u = fb.auth.currentUser;
    try {
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      await setDoc(doc(fb.db, "access_requests", u.uid), {
        email: (u.email || "").toLowerCase(),
        emailVerified: !!u.emailVerified,
        displayName: u.displayName || (u.email ? u.email.split("@")[0] : "User"),
        requestedAt: serverTimestamp(),
      });
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error)?.message || "Failed to request access." };
    }
  };

  const isAdmin = profile?.role === "admin" && status === "ready";

  const can = useCallback(
    (permission: PermissionKey): boolean => {
      if (status !== "ready" || !profile) return false;
      if (profile.role === "admin") return true;
      return role?.permissions?.[permission] === true;
    },
    [status, profile, role],
  );

  const user: UserContextValue | null = useMemo(() => {
    if (!profile || status !== "ready") return null;
    return {
      name: profile.displayName || profile.email.split("@")[0],
      email: profile.email,
      role: profile.role,
    };
  }, [profile, status]);

  const value: AuthContextValue = {
    status,
    firebaseUser,
    profile,
    role,
    user,
    ready: status !== "loading",
    isAdmin,
    can,
    login,
    logout: () => logout(false),
    sendPasswordReset,
    requestAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
