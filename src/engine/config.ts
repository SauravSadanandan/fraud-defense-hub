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

export interface Settings {
  targetCountry: string;
  funnelEvents: string[];
  zeroEventsGraceDays: number;
  deviceModelClusterThreshold: number;
  carrierIpThreshold: number;
  sdkMismatchMinSample: number;
  timeOfDayThresholdPct: number;
  timeOfDayMinSample: number;
  uniformTimingMinCount: number;
  uniformTimingBucketSeconds: number;
  knownCarriers: string[];
  buildFlaggedInstalls: boolean;
  buildFlaggedEvents: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  targetCountry: "IN",
  funnelEvents: ["af_first_open", "af_login", "af_purchase"],
  zeroEventsGraceDays: 3,
  deviceModelClusterThreshold: 10,
  carrierIpThreshold: 10,
  sdkMismatchMinSample: 5,
  timeOfDayThresholdPct: 15,
  timeOfDayMinSample: 20,
  uniformTimingMinCount: 5,
  uniformTimingBucketSeconds: 5,
  knownCarriers: ["Jio", "Airtel", "Vi", "Vodafone Idea", "Vodafone", "Idea", "BSNL", "MTNL"],
  buildFlaggedInstalls: true,
  buildFlaggedEvents: true,
};