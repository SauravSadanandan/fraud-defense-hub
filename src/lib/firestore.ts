import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFirebase, ensureFirebaseSession } from "./firebase";
import type { AnalysisResult } from "@/engine/types";

const COLLECTION = "fraud_datasets";
const MAX_FLAGGED = 1500; // keep Firestore docs under size limits

export interface DatasetMeta {
  id: string;
  label: string;
  mode: string;
  appName: string;
  startDate: string;
  endDate: string;
  totalRows: number;
  flaggedRows: number;
  generatedAt: number;
  pids: string[];
}

function trim(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    flaggedInstalls: result.flaggedInstalls.slice(0, MAX_FLAGGED),
    flaggedEvents: result.flaggedEvents.slice(0, MAX_FLAGGED),
  };
}

export async function saveAnalysis(result: AnalysisResult, label: string): Promise<string | null> {
  const fb = getFirebase();
  if (!fb) return null;
  const ok = await ensureFirebaseSession();
  if (!ok) return null;
  try {
    const payload = {
      label,
      mode: result.mode,
      appName: result.appName,
      startDate: result.startDate,
      endDate: result.endDate,
      totalRows: result.totalRows,
      flaggedRows: result.flaggedRows,
      generatedAt: result.generatedAt,
      pids: result.pids.slice(0, 500),
      result: JSON.stringify(trim(result)),
    };
    const ref = await addDoc(collection(fb.db, COLLECTION), payload);
    return ref.id;
  } catch (e) {
    console.warn("Firestore save failed (running client-side only):", e);
    return null;
  }
}

export async function listAnalyses(): Promise<DatasetMeta[]> {
  const fb = getFirebase();
  if (!fb) return [];
  const ok = await ensureFirebaseSession();
  if (!ok) return [];
  try {
    const q = query(collection(fb.db, COLLECTION), orderBy("generatedAt", "desc"), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id,
        label: v.label || "Untitled",
        mode: v.mode || "Install",
        appName: v.appName || "App",
        startDate: v.startDate || "",
        endDate: v.endDate || "",
        totalRows: v.totalRows || 0,
        flaggedRows: v.flaggedRows || 0,
        generatedAt: v.generatedAt || 0,
        pids: Array.isArray(v.pids) ? (v.pids as string[]) : [],
      };
    });
  } catch (e) {
    console.warn("Firestore list failed:", e);
    return [];
  }
}

export async function loadAnalysis(id: string): Promise<AnalysisResult | null> {
  const fb = getFirebase();
  if (!fb) return null;
  const ok = await ensureFirebaseSession();
  if (!ok) return null;
  try {
    const snap = await getDoc(doc(fb.db, COLLECTION, id));
    if (!snap.exists()) return null;
    const v = snap.data();
    return JSON.parse(v.result) as AnalysisResult;
  } catch (e) {
    console.warn("Firestore load failed:", e);
    return null;
  }
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  const fb = getFirebase();
  if (!fb) return false;
  const ok = await ensureFirebaseSession();
  if (!ok) return false;
  try {
    await deleteDoc(doc(fb.db, COLLECTION, id));
    return true;
  } catch {
    return false;
  }
}