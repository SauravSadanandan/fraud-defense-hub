import { getFirebase, ensureFirebaseSession } from "./firebase";

// Maps a PID (media source) to a human "Publisher" name.
// Keyed per-APP because a PID can be re-brokered: the same media source may be
// run by a different publisher on a different app.
export type PublisherMap = Record<string, string>; // pubKey -> publisher name

const LS_KEY = "farg_publisher_map_v1";
const COLLECTION = "publisher_map";

export function pubKey(appName: string, pid: string): string {
  return `${(appName || "App").trim()}||${(pid || "").trim()}`;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function docId(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 200) + "_" + hash(key);
}

function readLocal(): PublisherMap {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}") as PublisherMap;
  } catch {
    return {};
  }
}

function writeLocal(map: PublisherMap): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function loadPublisherMap(): Promise<PublisherMap> {
  const local = readLocal();
  const fb = getFirebase();
  if (!fb) return local;
  const ok = await ensureFirebaseSession();
  if (!ok) return local;
  try {
    const { collection, getDocs } = await import("firebase/firestore");
    const snap = await getDocs(collection(fb.db, COLLECTION));
    const remote: PublisherMap = {};
    snap.docs.forEach((d) => {
      const v = d.data();
      if (v.appName != null && v.pid != null && v.publisher) {
        remote[pubKey(String(v.appName), String(v.pid))] = String(v.publisher);
      }
    });
    const merged = { ...local, ...remote };
    writeLocal(merged);
    return merged;
  } catch (e) {
    console.warn("Publisher map load failed (client-side only):", e);
    return local;
  }
}

export async function setPublisher(appName: string, pid: string, publisher: string): Promise<void> {
  const key = pubKey(appName, pid);
  const name = publisher.trim();
  const local = readLocal();
  if (name) local[key] = name;
  else delete local[key];
  writeLocal(local);

  const fb = getFirebase();
  if (!fb) return;
  const ok = await ensureFirebaseSession();
  if (!ok) return;
  try {
    const { doc, setDoc, deleteDoc } = await import("firebase/firestore");
    const ref = doc(fb.db, COLLECTION, docId(key));
    if (name) await setDoc(ref, { appName, pid, publisher: name, updatedAt: Date.now() });
    else await deleteDoc(ref);
  } catch (e) {
    console.warn("Publisher map save failed (client-side only):", e);
  }
}

// Distinct, sorted publisher names for a given app across a set of pids.
export function publishersForApp(map: PublisherMap, appName: string, pids: string[]): string[] {
  const set = new Set<string>();
  pids.forEach((p) => {
    const name = map[pubKey(appName, p)];
    if (name) set.add(name);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}
