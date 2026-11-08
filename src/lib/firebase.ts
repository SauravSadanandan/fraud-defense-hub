import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

// Firebase web config is a PUBLIC identifier set — safe to commit.
// Your data is protected by Firebase Auth + Firestore Security Rules,
// not by hiding these values. See firestore.rules / DEPLOY.md.
export const firebaseConfig = {
  apiKey: "AIzaSyCkwRb-GfPCgqKcAOwRUGvWH8xtv1zL128",
  authDomain: "farg-e74ca.firebaseapp.com",
  projectId: "farg-e74ca",
  storageBucket: "farg-e74ca.firebasestorage.app",
  messagingSenderId: "833090159651",
  appId: "1:833090159651:web:34525c5d283e9ab1139d96",
  measurementId: "G-QWWXJERBZ9",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

// Lazily initialize Firebase on the client only (avoids SSR issues).
export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (typeof window === "undefined") return null;
  if (!_app) {
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
