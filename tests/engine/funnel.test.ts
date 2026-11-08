import { describe, it, expect } from "vitest";
import { enrichRows, computeEventSpecificFraud } from "../../src/engine/fraudEngine";
import { DEFAULT_SETTINGS, BLANK_SETTINGS, type Settings } from "../../src/engine/config";
import { FIXTURE_HEADERS } from "./fixtures";

function makeEventRow(overrides: Record<string, string> = {}): unknown[] {
  const map: Record<string, string> = {
    "Country Code": "IN",
    Carrier: "Jio",
    "AppsFlyer ID": "af_user_1",
    "Attributed Touch Time": "2025-01-10 10:00:00",
    "Install Time": "2025-01-10 10:01:00",
    "Event Time": "2025-01-10 10:02:00",
    "Event Name": "af_first_open",
    "Advertising ID": "gaid_123",
    "Device Model": "CleanModel",
    "OS Version": "13",
    Platform: "android",
    "Is Primary Attribution": "true",
    ...overrides,
  };
  return FIXTURE_HEADERS.map((h) => map[h] ?? "");
}

describe("Conversion Funnel Validation", () => {
  const customFunnelSettings: Settings = {
    ...DEFAULT_SETTINGS,
    funnelStages: [
      { name: "registration", label: "Registration", order: 0 },
      { name: "kyc_submit", label: "KYC Submit", order: 1 },
      { name: "kyc_approved", label: "KYC Approved", order: 2 },
      { name: "first_deposit", label: "First Deposit", order: 3 },
    ],
  };

  it("does not flag complete funnel progression", () => {
    const r1 = makeEventRow({ "Event Name": "registration", "Event Time": "2025-01-10 10:02:00" });
    const r2 = makeEventRow({ "Event Name": "kyc_submit", "Event Time": "2025-01-10 10:05:00" });
    const r3 = makeEventRow({ "Event Name": "kyc_approved", "Event Time": "2025-01-10 10:10:00" });
    const r4 = makeEventRow({ "Event Name": "first_deposit", "Event Time": "2025-01-10 10:15:00" });

    const enriched = enrichRows(FIXTURE_HEADERS, [r1, r2, r3, r4], customFunnelSettings);
    const { perInstallFlags, funnel } = computeEventSpecificFraud(enriched, customFunnelSettings);

    expect(perInstallFlags["af_user_1"]?.missingFunnelDesc).toBeUndefined();
    expect(funnel?.counts).toEqual([1, 1, 1, 1]);
  });

  it("flags users jumping ahead and skipping a required stage", () => {
    // User skipped registration and kyc_submit, went straight to first_deposit
    const rDirect = makeEventRow({
      "AppsFlyer ID": "af_fraud_user",
      "Event Name": "first_deposit",
      "Event Time": "2025-01-10 10:05:00",
    });

    const enriched = enrichRows(FIXTURE_HEADERS, [rDirect], customFunnelSettings);
    const { perInstallFlags } = computeEventSpecificFraud(enriched, customFunnelSettings);

    expect(perInstallFlags["af_fraud_user"]?.missingFunnelDesc).toBe(
      'Missing "registration" (stage 1) but reached "first_deposit" (stage 4)',
    );
    expect(enriched[0].signals).toContain(
      'Missing Funnel Event: Missing "registration" (stage 1) but reached "first_deposit" (stage 4)',
    );
  });

  it("does not compute funnel fraud if funnelStages is empty", () => {
    const r = makeEventRow({ "Event Name": "some_random_event" });
    const enriched = enrichRows(FIXTURE_HEADERS, [r], BLANK_SETTINGS);
    const { perInstallFlags, funnel } = computeEventSpecificFraud(enriched, BLANK_SETTINGS);

    expect(perInstallFlags).toEqual({});
    expect(funnel).toBeNull();
  });
});
