import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Firebase web config is a PUBLIC identifier set — safe to commit.
// Your data is protected by Firebase Auth + Firestore Security Rules,
// not by hiding these values. See firestore.rules / DEPLOY.md.
export const firebaseConfig = {
  apiKey: "AIzaSyD-placeholder-replace-with-real-key",
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
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
  }
  return { app: _app!, auth: _auth!, db: _db! };
}

// Best-effort anonymous session so Firestore writes work under the default
// admin login. If anonymous auth is disabled in the Firebase console this
// fails silently and the app keeps working fully client-side.
let anonTried = false;
export async function ensureFirebaseSession(): Promise<boolean> {
  const fb = getFirebase();
  if (!fb) return false;
  if (fb.auth.currentUser) return true;
  if (anonTried) return !!fb.auth.currentUser;
  anonTried = true;
  try {
    await signInAnonymously(fb.auth);
    return true;
  } catch {
    return false;
  }
}