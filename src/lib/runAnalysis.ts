import { processFile, type ProgressFn } from "@/engine/processFile";
import type { Settings } from "@/engine/config";
import type { AnalysisResult } from "@/engine/types";

// Runs the fraud engine in a Web Worker (keeps the UI responsive for 50k+
// rows). Falls back to main-thread processing if workers are unavailable.
export function runAnalysis(
  file: File,
  mode: "Install" | "Event",
  settings: Settings,
  onProgress?: ProgressFn,
): Promise<AnalysisResult> {
  if (typeof Worker !== "undefined") {
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL("../engine/worker.ts", import.meta.url), { type: "module" });
      } catch {
        processFile(file, mode, settings, onProgress).then(resolve, reject);
        return;
      }
      worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.type === "progress") onProgress?.(msg.progress, msg.message);
        else if (msg.type === "done") {
          resolve(msg.result as AnalysisResult);
          worker.terminate();
        } else if (msg.type === "error") {
          reject(new Error(msg.error));
          worker.terminate();
        }
      };
      worker.onerror = () => {
        // Fallback to main thread on worker bootstrap failure
        processFile(file, mode, settings, onProgress).then(resolve, reject);
        worker.terminate();
      };
      worker.postMessage({ file, mode, settings });
    });
  }
  return processFile(file, mode, settings, onProgress);
}