import { parseFile, type ProgressFn } from "../engine/processFile";
import { analyze } from "../engine/fraudEngine";
import { scanFile, type FileScan } from "../engine/scan";
import type { Settings } from "../engine/config";
import type { AnalysisResult } from "../engine/types";

export interface AnalysisSession {
  scan: FileScan;
  rowCount: number;
  run: (
    mode: "Install" | "Event",
    settings: Settings,
    profileMeta?: { id?: string; name?: string },
    onProgress?: ProgressFn,
  ) => Promise<AnalysisResult>;
  dispose: () => void;
}

export function createAnalysisSession(
  file: File,
  onProgress?: ProgressFn,
): Promise<AnalysisSession> {
  if (typeof Worker !== "undefined") {
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL("../engine/worker.ts", import.meta.url), { type: "module" });
      } catch {
        return createMainThreadSession(file, onProgress).then(resolve, reject);
      }

      let runProgressFn: ProgressFn | undefined;
      let runResolve: ((res: AnalysisResult) => void) | null = null;
      let runReject: ((err: Error) => void) | null = null;

      worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (!msg) return;

        if (msg.type === "progress") {
          if (runProgressFn) runProgressFn(msg.progress, msg.message);
          else onProgress?.(msg.progress, msg.message);
        } else if (msg.type === "loaded") {
          const session: AnalysisSession = {
            scan: msg.scan,
            rowCount: msg.rowCount,
            run: (mode, settings, profileMeta, progressFn) => {
              runProgressFn = progressFn;
              return new Promise((res, rej) => {
                runResolve = res;
                runReject = rej;
                worker.postMessage({
                  type: "run",
                  mode,
                  settings,
                  profileId: profileMeta?.id,
                  profileName: profileMeta?.name,
                });
              });
            },
            dispose: () => {
              try {
                worker.postMessage({ type: "dispose" });
                worker.terminate();
              } catch {
                /* ignore */
              }
            },
          };
          resolve(session);
        } else if (msg.type === "done") {
          if (runResolve) {
            runResolve(msg.result as AnalysisResult);
            runResolve = null;
            runReject = null;
          }
        } else if (msg.type === "error") {
          const err = new Error(msg.error);
          if (runReject) {
            runReject(err);
            runResolve = null;
            runReject = null;
          } else {
            reject(err);
            worker.terminate();
          }
        }
      };

      worker.onerror = () => {
        worker.terminate();
        createMainThreadSession(file, onProgress).then(resolve, reject);
      };

      worker.postMessage({ type: "load", file });
    });
  }

  return createMainThreadSession(file, onProgress);
}

async function createMainThreadSession(
  file: File,
  onProgress?: ProgressFn,
): Promise<AnalysisSession> {
  const { headers, rows } = await parseFile(file, onProgress);
  onProgress?.(35, "Scanning file characteristics…");
  const scan = scanFile(headers, rows);

  return {
    scan,
    rowCount: rows.length,
    run: async (mode, settings, profileMeta, progressFn) => {
      const result = analyze(headers, rows, mode, settings, progressFn);
      if (profileMeta?.id) result.profileId = profileMeta.id;
      if (profileMeta?.name) result.profileName = profileMeta.name;
      return result;
    },
    dispose: () => {
      // No worker to terminate
    },
  };
}

export async function runAnalysis(
  file: File,
  mode: "Install" | "Event",
  settings: Settings,
  onProgress?: ProgressFn,
): Promise<AnalysisResult> {
  const session = await createAnalysisSession(file, onProgress);
  try {
    return await session.run(mode, settings, undefined, onProgress);
  } finally {
    session.dispose();
  }
}
