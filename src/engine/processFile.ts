import Papa from "papaparse";
import * as XLSX from "xlsx";
import { analyze } from "./fraudEngine";
import { DEFAULT_SETTINGS, type Settings } from "./config";
import type { AnalysisResult } from "./types";

export type ProgressFn = (progress: number, message: string) => void;

export async function processFile(
  file: File,
  mode: "Install" | "Event",
  settings: Settings = DEFAULT_SETTINGS,
  onProgress?: ProgressFn,
): Promise<AnalysisResult> {
  onProgress?.(8, "Reading file…");
  const name = (file.name || "").toLowerCase();
  let headers: string[] = [];
  let rows: unknown[][] = [];

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("The spreadsheet has no readable sheet.");
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
    headers = (aoa[0] || []).map((h) => String(h ?? ""));
    rows = aoa.slice(1).filter((r) => Array.isArray(r) && r.some((c) => c !== "" && c !== null && c !== undefined));
  } else {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    const data = parsed.data as string[][];
    if (!data.length) throw new Error("The CSV file appears to be empty.");
    headers = (data[0] || []).map((h) => String(h ?? ""));
    rows = data.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ""));
  }

  if (!headers.length) throw new Error("No header row found in the file.");
  onProgress?.(30, `Parsed ${rows.length.toLocaleString()} rows`);
  return analyze(headers, rows, mode, settings, onProgress);
}