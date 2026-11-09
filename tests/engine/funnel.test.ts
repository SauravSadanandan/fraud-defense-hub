import { describe, it, expect } from "vitest";
import { enrichRows, computeEventSpecificFraud } from "../../src/engine/fraudEngine";
import {
  DEFAULT_SETTINGS,
  BLANK_SETTINGS,
  normalizeSettings,
  type Settings,
} from "../../src/engine/config";
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

describe("Conversion Funnel Validation (Funnel Model v2)", () => {
  const customFunnelSettings: Settings = {
    ...DEFAULT_SETTINGS,
    funnelStages: [
      {
        label: "Registration",
        eventNames: ["registration", "af_complete_registration"],
        optional: false,
      },
      { label: "KYC Submit", eventNames: ["kyc_submit", "af_kyc_submit"], optional: true },
      { label: "KYC Approved", eventNames: ["kyc_approved"], optional: false },
      { label: "First Deposit", eventNames: ["first_deposit", "af_purchase"], optional: false },
    ],
  };

  it("matches aliases case-insensitively and allows progression", () => {
    const r1 = makeEventRow({ "Event Name": "REGISTRATION", "Event Time": "2025-01-10 10:02:00" });
    const r2 = makeEventRow({ "Event Name": "kyc_approved", "Event Time": "2025-01-10 10:10:00" });
    const r3 = makeEventRow({ "Event Name": "af_purchase", "Event Time": "2025-01-10 10:15:00" });

    // Note: kyc_submit (stage 1) was skipped, but it is OPTIONAL, so no fraud flagged!
    const enriched = enrichRows(FIXTURE_HEADERS, [r1, r2, r3], customFunnelSettings);
    const { perInstallFlags, funnel } = computeEventSpecificFraud(enriched, customFunnelSettings);

    expect(perInstallFlags["af_user_1"]?.missingFunnelDesc).toBeUndefined();
    expect(funnel?.events).toEqual(["Registration", "KYC Submit", "KYC Approved", "First Deposit"]);
  });

  it("flags users jumping ahead and skipping a required non-optional stage", () => {
    // User skipped Registration (required) and KYC Submit (optional), reached KYC Approved
    const rDirect = makeEventRow({
      "AppsFlyer ID": "af_fraud_user",
      "Event Name": "kyc_approved",
      "Event Time": "2025-01-10 10:05:00",
    });

    const enriched = enrichRows(FIXTURE_HEADERS, [rDirect], customFunnelSettings);
    const { perInstallFlags } = computeEventSpecificFraud(enriched, customFunnelSettings);

    expect(perInstallFlags["af_fraud_user"]?.missingFunnelDesc).toBe(
      'Missing "Registration" (stage 1) but reached "KYC Approved" (stage 3)',
    );
    expect(enriched[0].signals).toContain(
      'Missing Funnel Event: Missing "Registration" (stage 1) but reached "KYC Approved" (stage 3)',
    );
  });

  it("resolves duplicate alias across stages by giving precedence to first stage", () => {
    const dupeSettings: Settings = {
      ...DEFAULT_SETTINGS,
      funnelStages: [
        { label: "Step A", eventNames: ["shared_event"], optional: false },
        { label: "Step B", eventNames: ["shared_event", "b_event"], optional: false },
      ],
    };

    const r = makeEventRow({ "Event Name": "shared_event" });
    const enriched = enrichRows(FIXTURE_HEADERS, [r], dupeSettings);
    const { funnel } = computeEventSpecificFraud(enriched, dupeSettings);

    // shared_event maps to Step A (index 0)
    expect(funnel?.counts).toEqual([1, 0]);
  });

  it("migrates all three funnel shapes correctly", () => {
    // 1. Legacy v1 shape (funnelEvents string array)
    const v1 = normalizeSettings({
      funnelEvents: ["open", "login", "pay"],
    });
    expect(v1.funnelStages).toEqual([
      { label: "open", eventNames: ["open"], optional: false },
      { label: "login", eventNames: ["login"], optional: false },
      { label: "pay", eventNames: ["pay"], optional: false },
    ]);

    // 2. Intermediate branch shape ({ name, label?, order? })
    const intermediate = normalizeSettings({
      funnelStages: [
        { name: "step_2", order: 2, label: "Step Two" },
        { name: "step_1", order: 1, label: "Step One" },
      ],
    });
    expect(intermediate.funnelStages).toEqual([
      { label: "Step One", eventNames: ["step_1"], optional: false },
      { label: "Step Two", eventNames: ["step_2"], optional: false },
    ]);

    // 3. New v2 shape ({ label, eventNames, optional })
    const v2 = normalizeSettings({
      funnelStages: [
        { label: "Install", eventNames: ["af_install", "af_install"], optional: false },
        { label: "Login", eventNames: ["af_login"], optional: true },
      ],
    });
    expect(v2.funnelStages).toEqual([
      { label: "Install", eventNames: ["af_install"], optional: false },
      { label: "Login", eventNames: ["af_login"], optional: true },
    ]);
  });

  it("does not compute funnel fraud if funnelStages is empty", () => {
    const r = makeEventRow({ "Event Name": "some_random_event" });
    const enriched = enrichRows(FIXTURE_HEADERS, [r], BLANK_SETTINGS);
    const { perInstallFlags, funnel } = computeEventSpecificFraud(enriched, BLANK_SETTINGS);

    expect(perInstallFlags).toEqual({});
    expect(funnel).toBeNull();
  });
});
