import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

// Firebase web config is a PUBLIC identifier set — safe to commit.
// Your data is protected by Firebase Auth + Firestore Security Rules,
// not by hiding these values. See firestore.rules / DEPLOY.md / docs/ENVIRONMENTS.md.

export const APP_ENV = (import.meta.env.VITE_APP_ENV || "") as "production" | "staging";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const firebaseConfig: FirebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  ...(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    ? { measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID }
    : {}),
};

function validateFirebaseEnv(): void {
  if (APP_ENV !== "production" && APP_ENV !== "staging") {
    throw new Error(
      `[Firebase] Invalid VITE_APP_ENV: "${APP_ENV}". Expected "production" or "staging". Check your environment configuration.`,
    );
  }
  const required: Array<keyof FirebaseWebConfig> = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];
  const missing = required.filter((key) => !firebaseConfig[key]);
  if (missing.length > 0) {
    throw new Error(
      `[Firebase] Missing required Firebase configuration keys for environment "${APP_ENV}": ${missing.join(", ")}. Verify your .env.${APP_ENV} file.`,
    );
  }
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

// Lazily initialize Firebase on the client only (avoids SSR issues).
export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (typeof window === "undefined") return null;
  if (!_app) {
    validateFirebaseEnv();
    const existing = getApps().find((a) => a.name === "[DEFAULT]");
    _app = existing || initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);

    if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") {
      try {
        connectAuthEmulator(_auth, "http://127.0.0.1:9099", { disableWarnings: true });
      } catch {
        // already connected
      }
      try {
        connectFirestoreEmulator(_db, "127.0.0.1", 8080);
      } catch {
        // already connected
      }
    }
  }
  return { app: _app!, auth: _auth!, db: _db! };
}

/**
 * Creates an isolated secondary auth instance (named "invite-secondary")
 * to create new user accounts without affecting the primary signed-in session.
 */
export function createSecondaryAuth(): { auth: Auth; cleanup: () => Promise<void> } {
  validateFirebaseEnv();
  const name = "invite-secondary";
  const existing = getApps().find((a) => a.name === name);
  const secondaryApp = existing || initializeApp(firebaseConfig, name);
  const secondaryAuth = getAuth(secondaryApp);

  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") {
    try {
      connectAuthEmulator(secondaryAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    } catch {
      // already connected
    }
  }

  const cleanup = async () => {
    try {
      const { signOut } = await import("firebase/auth");
      await signOut(secondaryAuth);
    } catch {
      /* ignore */
    }
    try {
      await deleteApp(secondaryApp);
    } catch {
      /* ignore */
    }
  };

  return { auth: secondaryAuth, cleanup };
}
