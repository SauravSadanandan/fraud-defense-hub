import { describe, it, expect } from "vitest";
import { enrichRows } from "../../src/engine/fraudEngine";
import { DEFAULT_SETTINGS, type Settings } from "../../src/engine/config";
import { FIXTURE_HEADERS } from "./fixtures";

function makeRow(overrides: Record<string, string> = {}): unknown[] {
  const map: Record<string, string> = {
    "Country Code": "IN",
    Carrier: "Jio",
    "AppsFlyer ID": "af_1",
    "Attributed Touch Time": "2025-01-10 10:00:00",
    "Install Time": "2025-01-10 10:15:00",
    "Advertising ID": "gaid_123",
    "Device Model": "CleanModel",
    "OS Version": "13",
    Platform: "android",
    "Is Primary Attribution": "true",
    ...overrides,
  };
  return FIXTURE_HEADERS.map((h) => map[h] ?? "");
}

describe("Configurable Fraud Thresholds", () => {
  it("honors custom CTIT click injection threshold", () => {
    // 7 seconds CTIT
    const row = makeRow({
      "Attributed Touch Time": "2025-01-10 10:00:00",
      "Install Time": "2025-01-10 10:00:07",
    });

    // Under default 10s threshold: flagged
    const defaultEnriched = enrichRows(FIXTURE_HEADERS, [row], DEFAULT_SETTINGS);
    expect(defaultEnriched[0].signals).toContain("Click Injection (CTIT<10s)");

    // Under custom 5s threshold: not flagged
    const customSettings: Settings = {
      ...DEFAULT_SETTINGS,
      thresholds: { ...DEFAULT_SETTINGS.thresholds, ctitClickInjectSec: 5 },
    };
    const customEnriched = enrichRows(FIXTURE_HEADERS, [row], customSettings);
    expect(customEnriched[0].signals).not.toContain(expect.stringContaining("Click Injection"));
  });

  it("honors custom CTIT click flooding threshold", () => {
    // 1.5 days CTIT (36 hours)
    const row = makeRow({
      "Attributed Touch Time": "2025-01-08 10:00:00",
      "Install Time": "2025-01-09 22:00:00",
    });

    // Under default 1d threshold: flagged
    const defaultEnriched = enrichRows(FIXTURE_HEADERS, [row], DEFAULT_SETTINGS);
    expect(defaultEnriched[0].signals).toContain("Click Flooding (CTIT>1d)");

    // Under custom 2d threshold: not flagged
    const customSettings: Settings = {
      ...DEFAULT_SETTINGS,
      thresholds: { ...DEFAULT_SETTINGS.thresholds, ctitClickFloodDays: 2 },
    };
    const customEnriched = enrichRows(FIXTURE_HEADERS, [row], customSettings);
    expect(customEnriched[0].signals).not.toContain(expect.stringContaining("Click Flooding"));
  });

  it("honors platform-aware outdated OS threshold", () => {
    const androidRow = makeRow({
      Platform: "android",
      "OS Version": "9",
    });
    const iosRow = makeRow({
      Platform: "ios",
      "OS Version": "14",
    });

    // Under defaults (android: 9, ios: 14), both are flagged
    const defaultEnriched = enrichRows(FIXTURE_HEADERS, [androidRow, iosRow], DEFAULT_SETTINGS);
    expect(defaultEnriched[0].signals).toContain("Outdated OS (Android 9)");
    expect(defaultEnriched[1].signals).toContain("Outdated OS (iOS 14)");

    // Lower iOS threshold to 12 -> iOS 14 is clean
    const customSettings: Settings = {
      ...DEFAULT_SETTINGS,
      thresholds: {
        ...DEFAULT_SETTINGS.thresholds,
        outdatedOsMaxMajor: { android: 8, ios: 12 },
      },
    };
    const customEnriched = enrichRows(FIXTURE_HEADERS, [androidRow, iosRow], customSettings);
    expect(customEnriched[0].signals).not.toContain(expect.stringContaining("Outdated OS"));
    expect(customEnriched[1].signals).not.toContain(expect.stringContaining("Outdated OS"));
  });

  it("uses dynamic timezone label in Time-of-Day cluster signal", () => {
    // 25 rows from same source all at 10:00 UTC
    const rows = Array.from({ length: 25 }, (_, i) =>
      makeRow({
        "AppsFlyer ID": `af_tz_${i}`,
        "Media Source": "tz_test_source",
        "Install Time": "2025-01-10 10:00:00",
        "Attributed Touch Time": "2025-01-10 09:00:00",
      }),
    );

    const customTzSettings: Settings = {
      ...DEFAULT_SETTINGS,
      timezoneLabel: "UTC",
    };

    const enriched = enrichRows(FIXTURE_HEADERS, rows, customTzSettings);
    expect(enriched[0].signals).toContain("Time-of-Day Cluster (Hour 10:00 UTC, 100% of source)");
  });
});
