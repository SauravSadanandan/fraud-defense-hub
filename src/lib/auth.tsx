import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getFirebase, ensureFirebaseSession } from "./firebase";

// Default operator credentials (works out-of-the-box). Additional users can
// sign in with a real Firebase Auth email/password if configured.
const DEFAULT_USER = "Admin";
const DEFAULT_PASS = "AdcountyAdmin@2026";
const STORAGE_KEY = "farg_auth_user";

export interface AuthUser {
  name: string;
  email: string;
  provider: "default" | "firebase";
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const u = JSON.parse(raw) as AuthUser;
        setUser(u);
        if (u.provider === "default") void ensureFirebaseSession();
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const login: AuthContextValue["login"] = async (username, password) => {
    const uname = username.trim();
    // Default operator account
    if (uname.toLowerCase() === DEFAULT_USER.toLowerCase() && password === DEFAULT_PASS) {
      const u: AuthUser = { name: "Admin", email: "admin@farg.local", provider: "default" };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      setUser(u);
      void ensureFirebaseSession();
      return { ok: true };
    }
    // Firebase email/password (for additional accounts)
    const fb = getFirebase();
    if (fb && uname.includes("@")) {
      try {
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        const cred = await signInWithEmailAndPassword(fb.auth, uname, password);
        const u: AuthUser = {
          name: cred.user.displayName || uname.split("@")[0],
          email: cred.user.email || uname,
          provider: "firebase",
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        setUser(u);
        return { ok: true };
      } catch {
        return { ok: false, error: "Invalid email or password." };
      }
    }
    return { ok: false, error: "Invalid username or password." };
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
    const fb = getFirebase();
    if (fb) {
      import("firebase/auth").then(({ signOut }) => signOut(fb.auth).catch(() => {}));
    }
  };

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}