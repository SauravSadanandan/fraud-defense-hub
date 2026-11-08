import { describe, it, expect } from "vitest";
import { createAnalysisSession } from "../../src/lib/runAnalysis";
import { DEFAULT_SETTINGS, BLANK_SETTINGS } from "../../src/engine/config";
import { FIXTURE_HEADERS } from "./fixtures";

function makeRow(overrides: Record<string, string> = {}): string {
  const map: Record<string, string> = {
    "Attributed Touch Type": "click",
    "Attributed Touch Time": "2025-01-10 10:00:00",
    "Install Time": "2025-01-10 10:15:00",
    "Media Source": "organic",
    Campaign: "campaign_1",
    "Site ID": "site_1",
    Region: "APAC",
    "Country Code": "IN",
    State: "MH",
    City: "Mumbai",
    IP: "49.32.1.1",
    Carrier: "Jio",
    "AppsFlyer ID": "af_1",
    "Advertising ID": "gaid_1",
    "Device Category": "phone",
    Platform: "android",
    "OS Version": "13",
    "App Version": "1.0.0",
    "SDK Version": "6.12.0",
    "Is Primary Attribution": "true",
    "Device Model": "Samsung SM-S911B",
    "Detection Date": "2025-01-10",
    "App Name": "TestApp",
    ...overrides,
  };
  return FIXTURE_HEADERS.map((h) => map[h] ?? "").join(",");
}

describe("createAnalysisSession", () => {
  const csvContent = [
    FIXTURE_HEADERS.join(","),
    makeRow({ "AppsFlyer ID": "af_1", "Country Code": "IN", Carrier: "Jio", IP: "49.32.1.1" }),
    makeRow({
      "AppsFlyer ID": "af_2",
      "Country Code": "US",
      Carrier: "Verizon",
      IP: "49.32.1.2",
      "Advertising ID": "gaid_2",
    }),
  ].join("\n");

  it("creates session, provides scan characteristics, and runs analysis", async () => {
    const file = new File([csvContent], "test_export.csv", { type: "text/csv" });
    const session = await createAnalysisSession(file);

    expect(session.rowCount).toBe(2);
    expect(session.scan.detectedMode).toBe("Install");
    expect(session.scan.countries.map((c) => c.country)).toContain("IN");
    expect(session.scan.countries.map((c) => c.country)).toContain("US");

    // Run 1: with India DEFAULT_SETTINGS -> US row gets Geo Mismatch
    const res1 = await session.run("Install", DEFAULT_SETTINGS, {
      id: "builtin:india-default",
      name: "India (Default)",
    });
    expect(res1.profileId).toBe("builtin:india-default");
    expect(res1.profileName).toBe("India (Default)");
    expect(res1.flaggedRows).toBe(1); // US row flagged

    // Run 2: with BLANK_SETTINGS -> No Geo Mismatch
    const res2 = await session.run("Install", BLANK_SETTINGS, {
      id: "builtin:blank",
      name: "Blank",
    });
    expect(res2.profileId).toBe("builtin:blank");
    expect(res2.flaggedRows).toBe(0); // neither row flagged

    session.dispose();
  });
});
