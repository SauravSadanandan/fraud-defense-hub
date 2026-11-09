import { describe, it, expect } from "vitest";
import { normalizeSettings, DEFAULT_SETTINGS, BLANK_SETTINGS } from "../../src/engine/config";

describe("normalizeSettings", () => {
  it("returns a deep clone of DEFAULT_SETTINGS for undefined, null, or empty object", () => {
    const s1 = normalizeSettings(undefined);
    expect(s1).toEqual(DEFAULT_SETTINGS);

    const s2 = normalizeSettings(null);
    expect(s2).toEqual(DEFAULT_SETTINGS);

    const s3 = normalizeSettings({});
    expect(s3.schemaVersion).toBe(2);
    expect(s3.flagZeroedGaid).toBe(true);
    expect(s3.emulatorKeywords).toEqual(["unknown", "generic", "emulator", "sdk"]);
    expect(s3.thresholds.outdatedOsMaxMajor).toEqual({ android: 9, ios: 9 });
  });

  it("migrates legacy v1 settings correctly", () => {
    const legacy = {
      targetCountry: "US",
      knownCarriers: ["Verizon", "AT&T"],
      funnelEvents: ["first_open", "purchase"],
      carrierIpThreshold: 15,
      deviceModelClusterThreshold: 12,
      sdkMismatchMinSample: 7,
      timeOfDayThresholdPct: 25,
      timeOfDayMinSample: 30,
      uniformTimingMinCount: 8,
      uniformTimingBucketSeconds: 10,
    };

    const normalized = normalizeSettings(legacy);
    expect(normalized.schemaVersion).toBe(2);
    expect(normalized.geos).toEqual([{ country: "US", knownCarriers: ["Verizon", "AT&T"] }]);
    expect(normalized.funnelStages).toEqual([
      { label: "first_open", eventNames: ["first_open"], optional: false },
      { label: "purchase", eventNames: ["purchase"], optional: false },
    ]);
    expect(normalized.timezoneLabel).toBe("IST");
    expect(normalized.flagZeroedGaid).toBe(true);
    expect(normalized.thresholds.carrierIpThreshold).toBe(15);
    expect(normalized.thresholds.deviceModelClusterThreshold).toBe(12);
    expect(normalized.thresholds.sdkMismatchMinSample).toBe(7);
    expect(normalized.thresholds.timeOfDayThresholdPct).toBe(25);
    expect(normalized.thresholds.uniformTimingMinCount).toBe(8);
    expect(normalized.thresholds.uniformTimingBucketSeconds).toBe(10);
    expect(normalized.thresholds.ctitClickInjectSec).toBe(10);
    expect(normalized.thresholds.outdatedOsMaxMajor).toEqual({ android: 9, ios: 9 });
  });

  it("migrates intermediate branch funnel shape ({ name, label?, order? })", () => {
    const intermediate = {
      funnelStages: [
        { name: "step_pay", order: 2, label: "Payment" },
        { name: "step_reg", order: 1, label: "Register" },
      ],
    };

    const normalized = normalizeSettings(intermediate);
    expect(normalized.funnelStages).toEqual([
      { label: "Register", eventNames: ["step_reg"], optional: false },
      { label: "Payment", eventNames: ["step_pay"], optional: false },
    ]);
  });

  it("handles empty geos and blank profile", () => {
    const blank = normalizeSettings(BLANK_SETTINGS);
    expect(blank.geos).toEqual([]);
    expect(blank.funnelStages).toEqual([]);
    expect(blank.timezoneLabel).toBe("UTC");
  });

  it("supports null to disable outdated OS checks per platform", () => {
    const disabledIos = normalizeSettings({
      thresholds: {
        outdatedOsMaxMajor: {
          android: 8,
          ios: null,
        },
      },
    });
    expect(disabledIos.thresholds.outdatedOsMaxMajor.android).toBe(8);
    expect(disabledIos.thresholds.outdatedOsMaxMajor.ios).toBeNull();
  });

  it("repairs invalid or negative threshold numbers defensively", () => {
    const corrupted = {
      schemaVersion: 2,
      geos: [{ country: "in", knownCarriers: ["Jio"] }],
      funnelStages: [{ label: "Login", eventNames: ["af_login"] }],
      flagZeroedGaid: false,
      thresholds: {
        ctitClickInjectSec: -5,
        ctitClickFloodDays: NaN,
        ipFarmThreshold: 0,
        outdatedOsMaxMajor: {
          android: "invalid",
          ios: -1,
        },
      },
    };

    const normalized = normalizeSettings(corrupted);
    expect(normalized.geos[0].country).toBe("IN");
    expect(normalized.flagZeroedGaid).toBe(false);
    expect(normalized.thresholds.ctitClickInjectSec).toBe(
      DEFAULT_SETTINGS.thresholds.ctitClickInjectSec,
    );
    expect(normalized.thresholds.ctitClickFloodDays).toBe(
      DEFAULT_SETTINGS.thresholds.ctitClickFloodDays,
    );
    expect(normalized.thresholds.ipFarmThreshold).toBe(DEFAULT_SETTINGS.thresholds.ipFarmThreshold);
    expect(normalized.thresholds.outdatedOsMaxMajor.android).toBe(9);
    expect(normalized.thresholds.outdatedOsMaxMajor.ios).toBe(9);
  });
});
