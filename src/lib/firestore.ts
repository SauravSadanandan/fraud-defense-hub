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
  writeBatch,
} from "firebase/firestore";
import { toast } from "sonner";
import { getFirebase } from "./firebase";
import type { AnalysisResult } from "@/engine/types";

const COLLECTION = "fraud_datasets";
const CHUNKS_SUBCOLLECTION = "chunks";
const MAX_FLAGGED = 1500; // keep individual rows reasonable
const INLINE_LIMIT_BYTES = 900_000; // safety margin under Firestore's 1,048,576 byte doc cap
const CHUNK_SIZE_CHARS = 900_000; // each chunk doc also stays under the same cap

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
  createdBy?: string;
  createdByEmail?: string;
}

function trim(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    flaggedInstalls: result.flaggedInstalls.slice(0, MAX_FLAGGED),
    flaggedEvents: result.flaggedEvents.slice(0, MAX_FLAGGED),
  };
}

function byteSize(str: string): number {
  return new Blob([str]).size;
}

function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "permission-denied"
  );
}

export async function saveAnalysis(result: AnalysisResult, label: string): Promise<string | null> {
  const fb = getFirebase();
  if (!fb || !fb.auth.currentUser) return null;

  const currentUser = fb.auth.currentUser;
  const resultJson = JSON.stringify(trim(result));
  const meta = {
    label,
    mode: result.mode,
    appName: result.appName,
    startDate: result.startDate,
    endDate: result.endDate,
    totalRows: result.totalRows,
    flaggedRows: result.flaggedRows,
    generatedAt: result.generatedAt,
    pids: result.pids.slice(0, 500),
    createdBy: currentUser.uid,
    createdByEmail: currentUser.email || "",
  };

  try {
    if (byteSize(resultJson) < INLINE_LIMIT_BYTES) {
      // Small enough to store inline
      const ref = await addDoc(collection(fb.db, COLLECTION), {
        ...meta,
        chunked: false,
        result: resultJson,
      });
      return ref.id;
    }

    // Too large for one document: create parent doc first (metadata only),
    // then write payload as ordered chunk subdocuments.
    const ref = await addDoc(collection(fb.db, COLLECTION), {
      ...meta,
      chunked: true,
      result: null,
    });

    const chunks: string[] = [];
    for (let i = 0; i < resultJson.length; i += CHUNK_SIZE_CHARS) {
      chunks.push(resultJson.slice(i, i + CHUNK_SIZE_CHARS));
    }

    for (let start = 0; start < chunks.length; start += 400) {
      const batch = writeBatch(fb.db);
      const slice = chunks.slice(start, start + 400);
      slice.forEach((chunkData, offset) => {
        const chunkRef = doc(collection(fb.db, COLLECTION, ref.id, CHUNKS_SUBCOLLECTION));
        batch.set(chunkRef, { index: start + offset, data: chunkData });
      });
      await batch.commit();
    }

    return ref.id;
  } catch (e) {
    if (isPermissionDenied(e)) {
      toast.error("Permission denied: You do not have permission to save analyses.");
    } else {
      console.warn("Firestore save failed:", e);
    }
    return null;
  }
}

export async function listAnalyses(): Promise<DatasetMeta[]> {
  const fb = getFirebase();
  if (!fb || !fb.auth.currentUser) return [];

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
        createdBy: v.createdBy,
        createdByEmail: v.createdByEmail,
      };
    });
  } catch (e) {
    if (isPermissionDenied(e)) {
      toast.error("Permission denied: You do not have permission to view saved analyses.");
    } else {
      console.warn("Firestore list failed:", e);
    }
    return [];
  }
}

export async function loadAnalysis(id: string): Promise<AnalysisResult | null> {
  const fb = getFirebase();
  if (!fb || !fb.auth.currentUser) return null;

  try {
    const snap = await getDoc(doc(fb.db, COLLECTION, id));
    if (!snap.exists()) return null;
    const v = snap.data();

    if (!v.chunked) {
      return JSON.parse(v.result) as AnalysisResult;
    }

    // Reassemble from ordered chunk subdocuments.
    const chunksQ = query(
      collection(fb.db, COLLECTION, id, CHUNKS_SUBCOLLECTION),
      orderBy("index", "asc"),
    );
    const chunksSnap = await getDocs(chunksQ);
    const resultJson = chunksSnap.docs.map((c) => c.data().data as string).join("");
    return JSON.parse(resultJson) as AnalysisResult;
  } catch (e) {
    if (isPermissionDenied(e)) {
      toast.error("Permission denied: You do not have permission to view this analysis.");
    } else {
      console.warn("Firestore load failed:", e);
    }
    return null;
  }
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  const fb = getFirebase();
  if (!fb || !fb.auth.currentUser) return false;

  try {
    const chunksSnap = await getDocs(collection(fb.db, COLLECTION, id, CHUNKS_SUBCOLLECTION));
    if (!chunksSnap.empty) {
      const batch = writeBatch(fb.db);
      chunksSnap.docs.forEach((c) => batch.delete(c.ref));
      await batch.commit();
    }
    await deleteDoc(doc(fb.db, COLLECTION, id));
    return true;
  } catch (e) {
    if (isPermissionDenied(e)) {
      toast.error("Permission denied: You do not have permission to delete analyses.");
    } else {
      console.warn("Firestore delete failed:", e);
    }
    return false;
  }
}
