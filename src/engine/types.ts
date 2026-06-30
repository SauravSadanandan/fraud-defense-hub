export interface EnrichedRow {
  rowIndex: number;
  appsflyerId: string;
  installHour: number | null;
  eventHour: number | null;
  ctitSeconds: number | null;
  ctitMinutes: number | null;
  ctitHours: number | null;
  installTimeMs: number | null;
  eventTimeMs: number | null;
  ip: string;
  ipCount: number;
  gaid: string;
  gaidCount: number;
  idfa: string;
  mediaSource: string;
  siteId: string;
  campaign: string;
  country: string;
  carrier: string;
  osVersion: string;
  sdkVersion: string;
  deviceModel: string;
  eventName: string;
  fraudReason: string;
  fraudSub: string;
  isPrimary: unknown;
  signals: string[];
  fraudCategory: string;
  signalCount: number;
  date: string;
}

export interface PerInstallFlag {
  missingFunnelDesc?: string;
  uniformTiming?: boolean;
  uniformTimingDesc?: string;
  zeroEvents?: boolean;
}

export interface DashboardState {
  total: number;
  clickFlood: number;
  hijack: number;
  bots: number;
  zeroGaid: number;
  ctitHigh: number;
  ctitLow: number;
  deviceCluster: number;
  timeOfDay: number;
  sdkMismatch: number;
  carrierMismatch: number;
  zeroEvents: number;
  missingFunnel: number;
  uniformTiming: number;
  byReason: Record<string, number>;
  bySubReason: Record<string, number>;
  byMedia: Record<string, number>;
  bySignal: Record<string, number>;
  bySiteId: Record<string, number>;
  ctitBuckets: Record<string, number>;
}

export interface PublisherRow {
  mediaSource: string;
  siteCount: number;
  total: number;
  clickFlood: number;
  installHijack: number;
  bots: number;
  clickPct: number;
  avgCtitMin: number | null;
  zeroGaid: number;
  outdatedOs: number;
  risk: string;
}

export interface DeviceModelRow {
  model: string;
  count: number;
  flagged: number;
}

export interface AnalysisResult {
  mode: "Install" | "Event";
  appName: string;
  startDate: string;
  endDate: string;
  totalRows: number;
  flaggedRows: number;
  data: Record<string, DashboardState>;
  pids: string[];
  publishers: PublisherRow[];
  deviceModels: DeviceModelRow[];
  flaggedInstalls: EnrichedRow[];
  flaggedEvents: EnrichedRow[];
  funnel: { events: string[]; counts: number[] } | null;
  generatedAt: number;
}