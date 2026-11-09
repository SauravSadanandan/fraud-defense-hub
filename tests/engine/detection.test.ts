import { describe, it, expect } from "vitest";
import { analyze, enrichRows } from "../../src/engine/fraudEngine";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "../../src/engine/config";
import { FIXTURE_HEADERS } from "./fixtures";

function makeRow(overrides: Record<string, string> = {}): unknown[] {
  const map: Record<string, string> = {
    "Country Code": "IN",
    Carrier: "Jio",
    "AppsFlyer ID": "af_1",
    "Attributed Touch Time": "2025-01-10 10:00:00",
    "Install Time": "2025-01-10 10:15:00",
    "Advertising ID": "00000000-0000-0000-0000-000000000000",
    "Device Model": "CleanPhoneModel",
    "OS Version": "13",
    Platform: "android",
    "Media Source": "organic",
    "Is Primary Attribution": "true",
    "App Name": "TestApp",
    ...overrides,
  };
  return FIXTURE_HEADERS.map((h) => map[h] ?? "");
}

describe("Detection Options (Zeroed GAID & Emulator Keywords)", () => {
  it("flags zeroed GAID by default and increments both counters", () => {
    const row = makeRow();
    const result = analyze(FIXTURE_HEADERS, [row], "Install", DEFAULT_SETTINGS);

    expect(result.data.All.zeroGaid).toBe(1);
    expect(result.publishers[0].zeroGaid).toBe(1);
    expect(result.flaggedInstalls[0].signals).toContain("Zeroed GAID (Device Farm/ID Spoof)");
  });

  it("suppresses zeroed GAID signal and both counters when flagZeroedGaid is false", () => {
    const row = makeRow();
    const noZeroGaidSettings: Settings = {
      ...DEFAULT_SETTINGS,
      flagZeroedGaid: false,
    };
    const result = analyze(FIXTURE_HEADERS, [row], "Install", noZeroGaidSettings);

    expect(result.data.All.zeroGaid).toBe(0);
    expect(result.publishers[0].zeroGaid).toBe(0);
    expect(result.flaggedInstalls).toEqual([]);
  });

  it("honors custom emulatorKeywords list", () => {
    const rowCustomEmu = makeRow({
      "Advertising ID": "clean_gaid_1",
      "Device Model": "Custom Nox Player VM",
    });
    const rowOldEmu = makeRow({
      "Advertising ID": "clean_gaid_2",
      "Device Model": "Generic Emulator Device",
    });

    const customSettings: Settings = {
      ...DEFAULT_SETTINGS,
      emulatorKeywords: ["nox", "bluestacks"],
    };

    const enriched = enrichRows(FIXTURE_HEADERS, [rowCustomEmu, rowOldEmu], customSettings);
    expect(enriched[0].signals).toContain("Unknown Device Model (Emulator)");
    // rowOldEmu contains "emulator" which is not in the custom keywords list
    expect(enriched[1].signals).not.toContain("Unknown Device Model (Emulator)");
  });

  it("normalizes emulatorKeywords defensively with limits", () => {
    const rawKeywords = [
      "  BLUESTACKS  ",
      "bluestacks", // duplicate
      "a".repeat(60), // long string (> 40)
      "",
      ...Array.from({ length: 40 }, (_, i) => `keyword_${i}`), // excess (> 30)
    ];

    const normalized = normalizeSettings({ emulatorKeywords: rawKeywords });
    expect(normalized.emulatorKeywords).toContain("bluestacks");
    expect(normalized.emulatorKeywords.length).toBeLessThanOrEqual(30);
    normalized.emulatorKeywords.forEach((k) => {
      expect(k.length).toBeLessThanOrEqual(40);
      expect(k).toBe(k.toLowerCase().trim());
    });
  });
});
