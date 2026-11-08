/// <reference lib="webworker" />
import { parseFile, processFile } from "./processFile";
import { analyze } from "./fraudEngine";
import { scanFile, type FileScan } from "./scan";
import { DEFAULT_SETTINGS, type Settings } from "./config";

let cachedHeaders: string[] = [];
let cachedRows: unknown[][] = [];
let cachedScan: FileScan | null = null;

self.onmessage = async (ev: MessageEvent) => {
  const data = ev.data || {};
  const post = (progress: number, message: string) =>
    (self as unknown as Worker).postMessage({ type: "progress", progress, message });

  try {
    // 1. Session Load
    if (data.type === "load") {
      const { file } = data;
      const { headers, rows } = await parseFile(file, post);
      cachedHeaders = headers;
      cachedRows = rows;
      post(35, "Scanning file characteristics…");
      cachedScan = scanFile(headers, rows);
      (self as unknown as Worker).postMessage({
        type: "loaded",
        scan: cachedScan,
        headers: cachedHeaders,
        rowCount: cachedRows.length,
      });
      return;
    }

    // 2. Scan (if re-scan requested on cached rows)
    if (data.type === "scan") {
      if (!cachedHeaders.length) {
        throw new Error("No file is currently loaded in the worker session.");
      }
      cachedScan = scanFile(cachedHeaders, cachedRows);
      (self as unknown as Worker).postMessage({ type: "scanned", scan: cachedScan });
      return;
    }

    // 3. Run Analysis on cached rows
    if (data.type === "run") {
      if (!cachedHeaders.length) {
        throw new Error("No file is currently loaded in the worker session.");
      }
      const { mode, settings, profileId, profileName } = data;
      const result = analyze(
        cachedHeaders,
        cachedRows,
        mode || "Install",
        settings || DEFAULT_SETTINGS,
        post,
      );
      if (profileId) result.profileId = profileId;
      if (profileName) result.profileName = profileName;
      (self as unknown as Worker).postMessage({ type: "done", result });
      return;
    }

    // 4. Dispose session
    if (data.type === "dispose") {
      cachedHeaders = [];
      cachedRows = [];
      cachedScan = null;
      (self as unknown as Worker).postMessage({ type: "disposed" });
      return;
    }

    // 5. Legacy one-shot execution
    const { file, mode, settings } = data;
    const result = await processFile(file, mode || "Install", settings || DEFAULT_SETTINGS, post);
    (self as unknown as Worker).postMessage({ type: "done", result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
