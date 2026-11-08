import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../../src/engine/fraudEngine";
import { DEFAULT_SETTINGS } from "../../src/engine/config";
import { generateInstallRows, generateEventRows } from "./fixtures";
import type { AnalysisResult, EnrichedRow } from "../../src/engine/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function stripAdditiveFields(res: AnalysisResult): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(res)) as Record<string, unknown>;
  delete clone.settings;
  delete clone.profileId;
  delete clone.profileName;

  const stripRow = (r: EnrichedRow) => {
    const rClone = { ...r };
    delete rClone.platform;
    return rClone;
  };

  if (Array.isArray(clone.flaggedInstalls)) {
    clone.flaggedInstalls = (clone.flaggedInstalls as EnrichedRow[]).map(stripRow);
  }
  if (Array.isArray(clone.flaggedEvents)) {
    clone.flaggedEvents = (clone.flaggedEvents as EnrichedRow[]).map(stripRow);
  }

  return clone;
}

describe("Golden Parity under DEFAULT_SETTINGS", () => {
  it("matches install golden snapshot byte-for-byte", () => {
    const goldenPath = resolve(__dirname, "__golden__", "install.default.json");
    const goldenRaw = JSON.parse(readFileSync(goldenPath, "utf8")) as AnalysisResult;

    const fixture = generateInstallRows(42);
    const result = analyze(fixture.headers, fixture.rows, "Install", DEFAULT_SETTINGS);
    result.generatedAt = 0;

    const cleaned = stripAdditiveFields(result);
    expect(cleaned).toEqual(goldenRaw);
  });

  it("matches event golden snapshot byte-for-byte", () => {
    const goldenPath = resolve(__dirname, "__golden__", "event.default.json");
    const goldenRaw = JSON.parse(readFileSync(goldenPath, "utf8")) as AnalysisResult;

    const fixture = generateEventRows(42);
    const result = analyze(fixture.headers, fixture.rows, "Event", DEFAULT_SETTINGS);
    result.generatedAt = 0;

    const cleaned = stripAdditiveFields(result);
    expect(cleaned).toEqual(goldenRaw);
  });
});
