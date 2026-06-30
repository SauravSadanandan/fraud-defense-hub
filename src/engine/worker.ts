/// <reference lib="webworker" />
import { processFile } from "./processFile";
import { DEFAULT_SETTINGS } from "./config";

self.onmessage = async (ev: MessageEvent) => {
  const { file, mode, settings } = ev.data || {};
  const post = (progress: number, message: string) =>
    (self as unknown as Worker).postMessage({ type: "progress", progress, message });
  try {
    const result = await processFile(file, mode, settings || DEFAULT_SETTINGS, post);
    (self as unknown as Worker).postMessage({ type: "done", result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};