import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import {
  DEFAULT_SETTINGS,
  BLANK_SETTINGS,
  normalizeSettings,
  type Settings,
} from "@/engine/config";

export interface CampaignProfile {
  id: string;
  name: string;
  description?: string;
  isBuiltin?: boolean;
  settings: Settings;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

export const BUILTIN_INDIA: CampaignProfile = {
  id: "builtin:india-default",
  name: "India (Default)",
  description: "Standard India profile with top domestic carriers and IST timezone.",
  isBuiltin: true,
  settings: DEFAULT_SETTINGS,
};

export const BUILTIN_BLANK: CampaignProfile = {
  id: "builtin:blank",
  name: "Blank (Global)",
  description: "Unrestricted global profile with no GEO, carrier, or funnel restrictions.",
  isBuiltin: true,
  settings: BLANK_SETTINGS,
};

export const BUILTIN_PROFILES: CampaignProfile[] = [BUILTIN_INDIA, BUILTIN_BLANK];

const COLLECTION_NAME = "campaign_profiles";
const LAST_PROFILE_STORAGE_KEY = "farg_last_profile_v1";

export async function listProfiles(): Promise<CampaignProfile[]> {
  const result: CampaignProfile[] = [...BUILTIN_PROFILES];
  const fb = getFirebase();
  if (!fb || !fb.auth.currentUser) return result;

  try {
    const q = query(collection(fb.db, COLLECTION_NAME), orderBy("name"));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data();
      result.push({
        id: d.id,
        name: data.name || "Untitled Profile",
        description: data.description || "",
        isBuiltin: false,
        settings: normalizeSettings(data.settings),
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });
  } catch (err) {
    // Return built-ins if unauthenticated, permission denied, or offline
    console.warn("Could not list campaign profiles from Firestore:", err);
  }

  return result;
}

export async function getProfile(id: string): Promise<CampaignProfile | null> {
  if (id === BUILTIN_INDIA.id) return BUILTIN_INDIA;
  if (id === BUILTIN_BLANK.id) return BUILTIN_BLANK;

  const fb = getFirebase();
  if (!fb) return null;

  try {
    const d = await getDoc(doc(fb.db, COLLECTION_NAME, id));
    if (!d.exists()) return null;
    const data = d.data();
    return {
      id: d.id,
      name: data.name || "Untitled Profile",
      description: data.description || "",
      isBuiltin: false,
      settings: normalizeSettings(data.settings),
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (err) {
    console.warn(`Could not get profile ${id}:`, err);
    return null;
  }
}

export async function createProfile(data: {
  name: string;
  description?: string;
  settings: Settings;
}): Promise<string> {
  const fb = getFirebase();
  if (!fb || !fb.auth.currentUser) {
    throw new Error("You must be signed in to create a campaign profile.");
  }

  const now = Date.now();
  const docRef = await addDoc(collection(fb.db, COLLECTION_NAME), {
    name: data.name.trim(),
    description: (data.description || "").trim(),
    settings: normalizeSettings(data.settings),
    createdBy: fb.auth.currentUser.uid,
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
}

export async function updateProfile(
  id: string,
  data: {
    name?: string;
    description?: string;
    settings?: Settings;
  },
): Promise<void> {
  if (id.startsWith("builtin:")) {
    throw new Error("Built-in profiles cannot be modified.");
  }

  const fb = getFirebase();
  if (!fb || !fb.auth.currentUser) {
    throw new Error("You must be signed in to update a campaign profile.");
  }

  const payload: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.description !== undefined) payload.description = data.description.trim();
  if (data.settings !== undefined) payload.settings = normalizeSettings(data.settings);

  await updateDoc(doc(fb.db, COLLECTION_NAME, id), payload);
}

export async function deleteProfile(id: string): Promise<void> {
  if (id.startsWith("builtin:")) {
    throw new Error("Built-in profiles cannot be deleted.");
  }

  const fb = getFirebase();
  if (!fb || !fb.auth.currentUser) {
    throw new Error("You must be signed in to delete a campaign profile.");
  }

  await deleteDoc(doc(fb.db, COLLECTION_NAME, id));
}

export function getLastProfileId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return BUILTIN_INDIA.id;
  }
  return window.localStorage.getItem(LAST_PROFILE_STORAGE_KEY) || BUILTIN_INDIA.id;
}

export function setLastProfileId(id: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(LAST_PROFILE_STORAGE_KEY, id);
}

export function clearLastProfileId(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(LAST_PROFILE_STORAGE_KEY);
}
