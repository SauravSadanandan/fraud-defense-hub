// Ported constants from the SNABBIT AppsFlyer Fraud Analysis GAS (v14).
export const CONFIG = {
  CTIT_CLICK_INJECT_S: 10,
  CTIT_CLICK_FLOOD_DAYS: 1,
  IP_FARM_THRESHOLD: 10,
  GAID_ZERO: "00000000-0000-0000-0000-000000000000",
  NULL_DEVICE_KEYWORDS: ["unknown", "generic", "emulator", "sdk"],
};

// AppsFlyer raw export column headers.
export const COL = {
  TOUCH_TYPE: "Attributed Touch Type",
  TOUCH_TIME: "Attributed Touch Time",
  INSTALL_TIME: "Install Time",
  EVENT_TIME: "Event Time",
  EVENT_NAME: "Event Name",
  PARTNER: "Partner",
  MEDIA_SOURCE: "Media Source",
  CHANNEL: "Channel",
  CAMPAIGN: "Campaign",
  SITE_ID: "Site ID",
  REGION: "Region",
  COUNTRY: "Country Code",
  STATE: "State",
  CITY: "City",
  IP: "IP",
  CARRIER: "Carrier",
  APPSFLYER_ID: "AppsFlyer ID",
  ADVERTISING_ID: "Advertising ID",
  ANDROID_ID: "Android ID",
  IDFA: "IDFA",
  DEVICE_CATEGORY: "Device Category",
  PLATFORM: "Platform",
  OS_VERSION: "OS Version",
  APP_VERSION: "App Version",
  SDK_VERSION: "SDK Version",
  IS_PRIMARY: "Is Primary Attribution",
  DEVICE_MODEL: "Device Model",
  FRAUD_REASON: "Fraud Reason",
  FRAUD_SUB: "Fraud Sub Reason",
  DETECTION_DATE: "Detection Date",
  APP_NAME: "App Name",
} as const;

export interface GeoRule {
  country: string; // ISO 2-letter uppercase, e.g. "IN"
  knownCarriers: string[]; // Known carrier names
}

export interface FunnelStage {
  name: string; // Event name, e.g. "af_first_open"
  label?: string; // Human-friendly label, e.g. "First Open"
  order: number; // 0-indexed order
}

export interface Thresholds {
  ctitClickInjectSec: number;
  ctitClickFloodDays: number;
  ipFarmThreshold: number;
  carrierIpThreshold: number;
  deviceModelClusterThreshold: number;
  sdkMismatchMinSample: number;
  timeOfDayThresholdPct: number;
  timeOfDayMinSample: number;
  uniformTimingMinCount: number;
  uniformTimingBucketSeconds: number;
  outdatedOsMaxMajor: {
    android: number;
    ios: number;
  };
}

export interface Settings {
  schemaVersion: 2;
  geos: GeoRule[];
  funnelStages: FunnelStage[];
  timezoneLabel: string;
  thresholds: Thresholds;
  buildFlaggedInstalls: boolean;
  buildFlaggedEvents: boolean;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  ctitClickInjectSec: 10,
  ctitClickFloodDays: 1,
  ipFarmThreshold: 10,
  carrierIpThreshold: 10,
  deviceModelClusterThreshold: 10,
  sdkMismatchMinSample: 5,
  timeOfDayThresholdPct: 15,
  timeOfDayMinSample: 20,
  uniformTimingMinCount: 5,
  uniformTimingBucketSeconds: 5,
  outdatedOsMaxMajor: {
    android: 9,
    ios: 14,
  },
};

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 2,
  geos: [
    {
      country: "IN",
      knownCarriers: ["Jio", "Airtel", "Vi", "Vodafone Idea", "Vodafone", "Idea", "BSNL", "MTNL"],
    },
  ],
  funnelStages: [
    { name: "af_first_open", label: "First Open", order: 0 },
    { name: "af_login", label: "Login", order: 1 },
    { name: "af_purchase", label: "Purchase", order: 2 },
  ],
  timezoneLabel: "IST",
  thresholds: { ...DEFAULT_THRESHOLDS },
  buildFlaggedInstalls: true,
  buildFlaggedEvents: true,
};

export const BLANK_SETTINGS: Settings = {
  schemaVersion: 2,
  geos: [],
  funnelStages: [],
  timezoneLabel: "UTC",
  thresholds: { ...DEFAULT_THRESHOLDS },
  buildFlaggedInstalls: true,
  buildFlaggedEvents: true,
};

function numOrDefault(val: unknown, def: number, min = 1): number {
  if (typeof val === "number" && !isNaN(val) && isFinite(val) && val >= min) {
    return val;
  }
  return def;
}

export function normalizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Settings;
  }

  const obj = raw as Record<string, unknown>;

  // Check for legacy v1 properties
  const isV1 =
    obj.schemaVersion !== 2 &&
    ("targetCountry" in obj || "knownCarriers" in obj || "funnelEvents" in obj);

  let geos: GeoRule[] = [];
  if (isV1) {
    const targetCountry = String(obj.targetCountry || "")
      .trim()
      .toUpperCase();
    if (targetCountry) {
      const carriers = Array.isArray(obj.knownCarriers)
        ? obj.knownCarriers.map((c) => String(c).trim()).filter(Boolean)
        : [];
      geos.push({ country: targetCountry, knownCarriers: carriers });
    } else {
      geos = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.geos));
    }
  } else if (Array.isArray(obj.geos)) {
    geos = obj.geos
      .map((g) => {
        if (!g || typeof g !== "object") return null;
        const gObj = g as Record<string, unknown>;
        const country = String(gObj.country || "")
          .trim()
          .toUpperCase();
        if (!country) return null;
        const knownCarriers = Array.isArray(gObj.knownCarriers)
          ? gObj.knownCarriers.map((c) => String(c).trim()).filter(Boolean)
          : [];
        return { country, knownCarriers };
      })
      .filter((g): g is GeoRule => g !== null);
  }

  let funnelStages: FunnelStage[] = [];
  if (isV1 && Array.isArray(obj.funnelEvents)) {
    funnelStages = obj.funnelEvents
      .map((name, idx) => ({
        name: String(name || "").trim(),
        order: idx,
      }))
      .filter((s) => Boolean(s.name));
  } else if (Array.isArray(obj.funnelStages)) {
    funnelStages = obj.funnelStages
      .map((s, idx) => {
        if (!s || typeof s !== "object") return null;
        const sObj = s as Record<string, unknown>;
        const name = String(sObj.name || "").trim();
        if (!name) return null;
        const label = sObj.label ? String(sObj.label).trim() : undefined;
        const order = typeof sObj.order === "number" && !isNaN(sObj.order) ? sObj.order : idx;
        return { name, ...(label ? { label } : {}), order };
      })
      .filter((s): s is FunnelStage => s !== null)
      .sort((a, b) => a.order - b.order);
  }

  const rawThresholds = (
    obj.thresholds && typeof obj.thresholds === "object" ? obj.thresholds : {}
  ) as Record<string, unknown>;

  const rawOs = (
    rawThresholds.outdatedOsMaxMajor && typeof rawThresholds.outdatedOsMaxMajor === "object"
      ? rawThresholds.outdatedOsMaxMajor
      : {}
  ) as Record<string, unknown>;

  const thresholds: Thresholds = {
    ctitClickInjectSec: numOrDefault(
      rawThresholds.ctitClickInjectSec ?? obj.ctitClickInjectSec,
      DEFAULT_THRESHOLDS.ctitClickInjectSec,
    ),
    ctitClickFloodDays: numOrDefault(
      rawThresholds.ctitClickFloodDays ?? obj.ctitClickFloodDays,
      DEFAULT_THRESHOLDS.ctitClickFloodDays,
    ),
    ipFarmThreshold: numOrDefault(
      rawThresholds.ipFarmThreshold ?? obj.ipFarmThreshold,
      DEFAULT_THRESHOLDS.ipFarmThreshold,
    ),
    carrierIpThreshold: numOrDefault(
      rawThresholds.carrierIpThreshold ?? obj.carrierIpThreshold,
      DEFAULT_THRESHOLDS.carrierIpThreshold,
    ),
    deviceModelClusterThreshold: numOrDefault(
      rawThresholds.deviceModelClusterThreshold ?? obj.deviceModelClusterThreshold,
      DEFAULT_THRESHOLDS.deviceModelClusterThreshold,
    ),
    sdkMismatchMinSample: numOrDefault(
      rawThresholds.sdkMismatchMinSample ?? obj.sdkMismatchMinSample,
      DEFAULT_THRESHOLDS.sdkMismatchMinSample,
    ),
    timeOfDayThresholdPct: numOrDefault(
      rawThresholds.timeOfDayThresholdPct ?? obj.timeOfDayThresholdPct,
      DEFAULT_THRESHOLDS.timeOfDayThresholdPct,
    ),
    timeOfDayMinSample: numOrDefault(
      rawThresholds.timeOfDayMinSample ?? obj.timeOfDayMinSample,
      DEFAULT_THRESHOLDS.timeOfDayMinSample,
    ),
    uniformTimingMinCount: numOrDefault(
      rawThresholds.uniformTimingMinCount ?? obj.uniformTimingMinCount,
      DEFAULT_THRESHOLDS.uniformTimingMinCount,
    ),
    uniformTimingBucketSeconds: numOrDefault(
      rawThresholds.uniformTimingBucketSeconds ?? obj.uniformTimingBucketSeconds,
      DEFAULT_THRESHOLDS.uniformTimingBucketSeconds,
    ),
    outdatedOsMaxMajor: {
      android: numOrDefault(rawOs.android, DEFAULT_THRESHOLDS.outdatedOsMaxMajor.android),
      ios: numOrDefault(rawOs.ios, DEFAULT_THRESHOLDS.outdatedOsMaxMajor.ios),
    },
  };

  const timezoneLabel = String(obj.timezoneLabel || "").trim() || (isV1 ? "IST" : "UTC");
  const buildFlaggedInstalls = Boolean(obj.buildFlaggedInstalls ?? true);
  const buildFlaggedEvents = Boolean(obj.buildFlaggedEvents ?? true);

  return {
    schemaVersion: 2,
    geos,
    funnelStages,
    timezoneLabel,
    thresholds,
    buildFlaggedInstalls,
    buildFlaggedEvents,
  };
}
