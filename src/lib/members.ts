import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  onSnapshot,
  getDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { getFirebase, createSecondaryAuth } from "./firebase";
import { DEFAULT_ROLES, type PermissionKey } from "./permissions";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  status: "active" | "disabled";
  createdAt: Timestamp | null;
  createdBy: string;
  updatedAt: Timestamp | null;
  updatedBy: string;
}

export interface RoleDoc {
  id: string;
  name: string;
  description: string;
  system: boolean;
  permissions: Record<string, boolean>;
  updatedAt: Timestamp | null;
  updatedBy: string;
}

export interface AccessRequestDoc {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  requestedAt: Timestamp | null;
}

function generateSecureRandomPassword(length = 24): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}

export function subscribeUsers(
  cb: (users: UserProfile[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    collection(fb.db, "users"),
    (snap) => {
      const users: UserProfile[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || "",
          displayName: data.displayName || "",
          role: data.role || "analyst",
          status: data.status || "active",
          createdAt: data.createdAt || null,
          createdBy: data.createdBy || "",
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || "",
        };
      });
      cb(users);
    },
    (err) => {
      onError?.(err);
    },
  );
}

export function subscribeRoles(
  cb: (roles: RoleDoc[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    collection(fb.db, "roles"),
    (snap) => {
      const roles: RoleDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || d.id,
          description: data.description || "",
          system: !!data.system,
          permissions: (data.permissions as Record<string, boolean>) || {},
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || "",
        };
      });
      cb(roles);
    },
    (err) => {
      onError?.(err);
    },
  );
}

export function subscribeAccessRequests(
  cb: (requests: AccessRequestDoc[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    collection(fb.db, "access_requests"),
    (snap) => {
      const requests: AccessRequestDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || "",
          emailVerified: !!data.emailVerified,
          displayName: data.displayName || "",
          requestedAt: data.requestedAt || null,
        };
      });
      cb(requests);
    },
    (err) => {
      onError?.(err);
    },
  );
}

export async function updateUserRole(
  targetUid: string,
  newRole: string,
  actorUid: string,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");
  await updateDoc(doc(fb.db, "users", targetUid), {
    role: newRole,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  });
}

export async function updateUserStatus(
  targetUid: string,
  newStatus: "active" | "disabled",
  actorUid: string,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");
  await updateDoc(doc(fb.db, "users", targetUid), {
    status: newStatus,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  });
}

export async function deleteUserProfile(targetUid: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");
  await deleteDoc(doc(fb.db, "users", targetUid));
}

export async function resendInviteEmail(email: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");
  await sendPasswordResetEmail(fb.auth, email.trim().toLowerCase());
}

export interface InviteResult {
  ok: boolean;
  emailSent: boolean;
  error?: string;
  alreadyExists?: boolean;
}

export async function inviteUser({
  email,
  displayName,
  role,
  actorUid,
}: {
  email: string;
  displayName: string;
  role: string;
  actorUid: string;
}): Promise<InviteResult> {
  const fb = getFirebase();
  if (!fb) return { ok: false, emailSent: false, error: "Firebase unavailable." };

  const cleanEmail = email.trim().toLowerCase();
  const secondary = createSecondaryAuth();
  let newUid = "";
  let emailSent = false;

  try {
    const password = generateSecureRandomPassword(24);
    const cred = await createUserWithEmailAndPassword(secondary.auth, cleanEmail, password);
    newUid = cred.user.uid;

    await setDoc(doc(fb.db, "users", newUid), {
      email: cleanEmail,
      displayName: displayName.trim() || cleanEmail.split("@")[0],
      role,
      status: "active",
      createdAt: serverTimestamp(),
      createdBy: actorUid,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });

    try {
      await sendPasswordResetEmail(fb.auth, cleanEmail);
      emailSent = true;
    } catch {
      emailSent = false;
    }

    return { ok: true, emailSent };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/email-already-in-use") {
      return {
        ok: false,
        emailSent: false,
        alreadyExists: true,
        error:
          "This person already has an authentication account. Ask them to sign in once and request access, then approve them under Pending access requests.",
      };
    }
    return {
      ok: false,
      emailSent: false,
      error: (err as Error)?.message || "Failed to invite user.",
    };
  } finally {
    await secondary.cleanup();
  }
}

export async function approveAccessRequest(
  request: AccessRequestDoc,
  role: string,
  actorUid: string,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");

  const batch = writeBatch(fb.db);
  const userRef = doc(fb.db, "users", request.uid);
  const reqRef = doc(fb.db, "access_requests", request.uid);

  batch.set(userRef, {
    email: request.email.trim().toLowerCase(),
    displayName: request.displayName || request.email.split("@")[0],
    role,
    status: "active",
    createdAt: serverTimestamp(),
    createdBy: actorUid,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  });

  batch.delete(reqRef);
  await batch.commit();
}

export async function rejectAccessRequest(uid: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");
  await deleteDoc(doc(fb.db, "access_requests", uid));
}

export async function seedDefaultRolesIfNeeded(actorUid: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const analystRef = doc(fb.db, "roles", "analyst");
  const snap = await getDoc(analystRef);
  if (!snap.exists()) {
    await setDoc(analystRef, {
      name: DEFAULT_ROLES.analyst.name,
      description: DEFAULT_ROLES.analyst.description,
      system: true,
      permissions: DEFAULT_ROLES.analyst.permissions,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });
  }
}

export async function saveRolePermissions(
  roleId: string,
  permissions: Record<PermissionKey, boolean>,
  actorUid: string,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");

  // Prevent assigning members.manage or roles.manage to non-admin roles
  const sanitized = { ...permissions };
  delete (sanitized as Record<string, boolean>)["members.manage"];
  delete (sanitized as Record<string, boolean>)["roles.manage"];

  await updateDoc(doc(fb.db, "roles", roleId), {
    permissions: sanitized,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  });
}

export async function createCustomRole({
  roleId,
  name,
  description,
  actorUid,
}: {
  roleId: string;
  name: string;
  description: string;
  actorUid: string;
}): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");

  const slug = roleId.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,32}$/.test(slug)) {
    throw new Error("Role ID must be 2-32 lowercase alphanumeric characters or hyphens.");
  }
  if (slug === "admin") {
    throw new Error("Role 'admin' is reserved.");
  }

  const roleRef = doc(fb.db, "roles", slug);
  const snap = await getDoc(roleRef);
  if (snap.exists()) {
    throw new Error("A role with this ID already exists.");
  }

  // Starts from analyst defaults
  const permissions = { ...DEFAULT_ROLES.analyst.permissions };

  await setDoc(roleRef, {
    name: name.trim(),
    description: description.trim(),
    system: false,
    permissions,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  });
}

export async function deleteCustomRole(roleId: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase unavailable");
  if (roleId === "admin" || roleId === "analyst") {
    throw new Error("System roles cannot be deleted.");
  }
  await deleteDoc(doc(fb.db, "roles", roleId));
}
