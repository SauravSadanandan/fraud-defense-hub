#!/usr/bin/env bun
/**
 * Generates synthetic install and event CSV fixtures for staging testing.
 * Uses deterministic fixtures from tests/engine/fixtures.ts.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateInstallRows, generateEventRows } from "../tests/engine/fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const outDir = join(repoRoot, "sample-data");

function toCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsvFile(filePath: string, headers: string[], rows: Record<string, string>[]) {
  const headerLine = headers.map(toCsvValue).join(",");
  const dataLines = rows.map((row) => headers.map((h) => toCsvValue(row[h] ?? "")).join(","));
  const content = [headerLine, ...dataLines].join("\n") + "\n";
  writeFileSync(filePath, content, "utf8");
}

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

console.log("[sample-data] Generating synthetic staging data (seed: 42)...");

const installData = generateInstallRows(42);
const installPath = join(outDir, "install_sample.csv");
writeCsvFile(installPath, installData.headers, installData.rows);
console.log(`[sample-data] Wrote ${installData.rows.length} rows to ${installPath}`);

const eventData = generateEventRows(42);
const eventPath = join(outDir, "event_sample.csv");
writeCsvFile(eventPath, eventData.headers, eventData.rows);
console.log(`[sample-data] Wrote ${eventData.rows.length} rows to ${eventPath}`);

console.log("[sample-data] Done.");
