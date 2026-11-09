// Ported constants from the AppsFlyer Fraud Analysis engine.
export const CONFIG = {
  GAID_ZERO: "00000000-0000-0000-0000-000000000000",
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
  label: string; // Human-friendly stage label
  eventNames: string[]; // Aliases/event names belonging to this stage
  optional: boolean; // Whether stage can be skipped without flagging fraud
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
    android: number | null;
    ios: number | null;
  };
}

export interface Settings {
  schemaVersion: 2;
  geos: GeoRule[];
  funnelStages: FunnelStage[];
  timezoneLabel: string;
  thresholds: Thresholds;
  flagZeroedGaid: boolean;
  emulatorKeywords: string[];
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
    ios: 9,
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
    { label: "af_first_open", eventNames: ["af_first_open"], optional: false },
    { label: "af_login", eventNames: ["af_login"], optional: false },
    { label: "af_purchase", eventNames: ["af_purchase"], optional: false },
  ],
  timezoneLabel: "IST",
  thresholds: { ...DEFAULT_THRESHOLDS },
  flagZeroedGaid: true,
  emulatorKeywords: ["unknown", "generic", "emulator", "sdk"],
  buildFlaggedInstalls: true,
  buildFlaggedEvents: true,
};

export const BLANK_SETTINGS: Settings = {
  schemaVersion: 2,
  geos: [],
  funnelStages: [],
  timezoneLabel: "UTC",
  thresholds: { ...DEFAULT_THRESHOLDS },
  flagZeroedGaid: true,
  emulatorKeywords: ["unknown", "generic", "emulator", "sdk"],
  buildFlaggedInstalls: true,
  buildFlaggedEvents: true,
};

function numOrDefault(val: unknown, def: number, min = 1): number {
  if (typeof val === "number" && !isNaN(val) && isFinite(val) && val >= min) {
    return val;
  }
  return def;
}

function parseOsThreshold(val: unknown, def: number | null): number | null {
  if (val === null) return null;
  if (typeof val === "number" && !isNaN(val) && isFinite(val) && val >= 1) {
    return Math.floor(val);
  }
  if (typeof val === "string") {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === "" || trimmed === "null" || trimmed === "disabled") return null;
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed >= 1) return parsed;
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
    // Migration 1: legacy v1 funnelEvents string array
    funnelStages = obj.funnelEvents
      .map((name) => {
        const str = String(name || "")
          .trim()
          .slice(0, 80);
        return {
          label: str,
          eventNames: [str],
          optional: false,
        };
      })
      .filter((s) => s.label.length > 0)
      .slice(0, 30);
  } else if (Array.isArray(obj.funnelStages)) {
    const rawStages = obj.funnelStages;
    // Check if intermediate shape ({ name, label?, order? })
    const isIntermediate = rawStages.some(
      (s) => s && typeof s === "object" && "name" in (s as Record<string, unknown>),
    );

    if (isIntermediate) {
      // Migration 2: intermediate { name, label?, order? } shape
      type IntermediateStage = { name?: unknown; label?: unknown; order?: unknown };
      const sorted = (rawStages as IntermediateStage[]).slice().sort((a, b) => {
        const orderA = typeof a?.order === "number" ? a.order : 0;
        const orderB = typeof b?.order === "number" ? b.order : 0;
        return orderA - orderB;
      });

      funnelStages = sorted
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const rawName = String(s.name || "")
            .trim()
            .slice(0, 80);
          const rawLabel = String(s.label || s.name || "")
            .trim()
            .slice(0, 80);
          if (!rawName && !rawLabel) return null;
          const label = rawLabel || rawName;
          const eventName = rawName || rawLabel;
          return {
            label,
            eventNames: [eventName],
            optional: false,
          };
        })
        .filter((s): s is FunnelStage => s !== null && s.eventNames.length > 0)
        .slice(0, 30);
    } else {
      // Shape v2: { label, eventNames, optional }
      funnelStages = rawStages
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const sObj = s as Record<string, unknown>;
          const rawEventNames = Array.isArray(sObj.eventNames) ? sObj.eventNames : [];
          const eventNames = Array.from(
            new Set(
              rawEventNames
                .map((e) =>
                  String(e || "")
                    .trim()
                    .slice(0, 80),
                )
                .filter(Boolean),
            ),
          ).slice(0, 10);

          const rawLabel = String(sObj.label || "")
            .trim()
            .slice(0, 80);
          const label = rawLabel || eventNames[0] || "";
          if (!label || eventNames.length === 0) return null;

          return {
            label,
            eventNames,
            optional: Boolean(sObj.optional),
          };
        })
        .filter((s): s is FunnelStage => s !== null)
        .slice(0, 30);
    }
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
      android: parseOsThreshold(
        rawOs.android !== undefined ? rawOs.android : rawThresholds.outdatedOsAndroid,
        DEFAULT_THRESHOLDS.outdatedOsMaxMajor.android,
      ),
      ios: parseOsThreshold(
        rawOs.ios !== undefined ? rawOs.ios : rawThresholds.outdatedOsIos,
        DEFAULT_THRESHOLDS.outdatedOsMaxMajor.ios,
      ),
    },
  };

  const timezoneLabel = String(obj.timezoneLabel || "").trim() || (isV1 ? "IST" : "UTC");
  const flagZeroedGaid = Boolean(obj.flagZeroedGaid ?? true);

  let emulatorKeywords: string[] = ["unknown", "generic", "emulator", "sdk"];
  if (Array.isArray(obj.emulatorKeywords)) {
    const cleaned = Array.from(
      new Set(
        obj.emulatorKeywords
          .map((k) =>
            String(k || "")
              .trim()
              .toLowerCase()
              .slice(0, 40),
          )
          .filter(Boolean),
      ),
    ).slice(0, 30);
    if (cleaned.length > 0) {
      emulatorKeywords = cleaned;
    }
  }

  const buildFlaggedInstalls = Boolean(obj.buildFlaggedInstalls ?? true);
  const buildFlaggedEvents = Boolean(obj.buildFlaggedEvents ?? true);

  return {
    schemaVersion: 2,
    geos,
    funnelStages,
    timezoneLabel,
    thresholds,
    flagZeroedGaid,
    emulatorKeywords,
    buildFlaggedInstalls,
    buildFlaggedEvents,
  };
}
