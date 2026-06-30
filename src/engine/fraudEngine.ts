import { CONFIG, COL, type Settings } from "./config";
import { parseDate } from "./parseDate";
import type {
  EnrichedRow,
  DashboardState,
  PublisherRow,
  DeviceModelRow,
  AnalysisResult,
  PerInstallFlag,
} from "./types";

type Row = unknown[];

function buildIndex(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = String(h ?? "").trim().toLowerCase();
    if (key && !(key in idx)) idx[key] = i;
  });
  return idx;
}

function getVal(row: Row, idx: Record<string, number>, col: string): string {
  const i = idx[col.trim().toLowerCase()];
  if (i === undefined) return "";
  const v = row[i];
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

export function enrichRows(headers: string[], rows: Row[], settings: Settings): EnrichedRow[] {
  const idx = buildIndex(headers);
  const ipMap: Record<string, number> = {};
  const gaidMap: Record<string, number> = {};
  const idfaMap: Record<string, number> = {};
  const deviceModelMap: Record<string, number> = {};
  const carrierIpMap: Record<string, number> = {};
  const sdkBySource: Record<string, Record<string, number>> = {};
  const hourBySource: Record<string, Record<number, number>> = {};
  const totalBySource: Record<string, number> = {};

  // First pass: frequency maps
  rows.forEach((r) => {
    const ip = getVal(r, idx, COL.IP);
    if (ip) ipMap[ip] = (ipMap[ip] || 0) + 1;
    const gaid = getVal(r, idx, COL.ADVERTISING_ID);
    if (gaid && gaid !== CONFIG.GAID_ZERO) gaidMap[gaid] = (gaidMap[gaid] || 0) + 1;
    const idfa = getVal(r, idx, COL.IDFA);
    if (idfa && idfa.trim() !== "") idfaMap[idfa] = (idfaMap[idfa] || 0) + 1;
    const dm = getVal(r, idx, COL.DEVICE_MODEL).trim().toLowerCase();
    if (dm) deviceModelMap[dm] = (deviceModelMap[dm] || 0) + 1;
    const carrier = getVal(r, idx, COL.CARRIER);
    if (ip && carrier) {
      const k = ip + "|" + carrier;
      carrierIpMap[k] = (carrierIpMap[k] || 0) + 1;
    }
    const mediaSource = getVal(r, idx, COL.MEDIA_SOURCE) || "(none)";
    const sdkVersion = getVal(r, idx, COL.SDK_VERSION);
    if (sdkVersion) {
      if (!sdkBySource[mediaSource]) sdkBySource[mediaSource] = {};
      sdkBySource[mediaSource][sdkVersion] = (sdkBySource[mediaSource][sdkVersion] || 0) + 1;
    }
    const refTime = parseDate(getVal(r, idx, COL.INSTALL_TIME)) || parseDate(getVal(r, idx, COL.EVENT_TIME));
    if (refTime) {
      const hour = refTime.hour;
      if (!hourBySource[mediaSource]) hourBySource[mediaSource] = {};
      hourBySource[mediaSource][hour] = (hourBySource[mediaSource][hour] || 0) + 1;
      totalBySource[mediaSource] = (totalBySource[mediaSource] || 0) + 1;
    }
  });

  const sdkModeBySource: Record<string, { mode: string; total: number }> = {};
  Object.keys(sdkBySource).forEach((src) => {
    const freqs = sdkBySource[src];
    const total = Object.values(freqs).reduce((a, b) => a + b, 0);
    if (total < settings.sdkMismatchMinSample) return;
    let mode = "";
    let modeCount = -1;
    Object.entries(freqs).forEach(([v, c]) => {
      if (c > modeCount) {
        mode = v;
        modeCount = c;
      }
    });
    sdkModeBySource[src] = { mode, total };
  });

  const knownCarriersLower = (settings.knownCarriers || []).map((c) => String(c).trim().toLowerCase());

  return rows.map((r, i) => {
    const touch = parseDate(getVal(r, idx, COL.TOUCH_TIME));
    const install = parseDate(getVal(r, idx, COL.INSTALL_TIME));
    const event = parseDate(getVal(r, idx, COL.EVENT_TIME));
    const ctitSeconds = touch && install ? (install.ms - touch.ms) / 1000 : null;

    const ip = getVal(r, idx, COL.IP);
    const gaid = getVal(r, idx, COL.ADVERTISING_ID);
    const idfa = getVal(r, idx, COL.IDFA);
    const deviceModelRaw = getVal(r, idx, COL.DEVICE_MODEL);
    const deviceModel = deviceModelRaw.toLowerCase().trim();
    const osVersion = getVal(r, idx, COL.OS_VERSION);
    const isPrimaryRaw = getVal(r, idx, COL.IS_PRIMARY);
    const fraudReason = getVal(r, idx, COL.FRAUD_REASON);
    const fraudSub = getVal(r, idx, COL.FRAUD_SUB);
    const mediaSource = getVal(r, idx, COL.MEDIA_SOURCE) || "(none)";
    const siteId = getVal(r, idx, COL.SITE_ID);
    const campaign = getVal(r, idx, COL.CAMPAIGN);
    const country = getVal(r, idx, COL.COUNTRY);
    const carrier = getVal(r, idx, COL.CARRIER);
    const sdkVersion = getVal(r, idx, COL.SDK_VERSION);
    const appsflyerId = getVal(r, idx, COL.APPSFLYER_ID);
    const eventName = getVal(r, idx, COL.EVENT_NAME);

    const installHour = install ? install.hour : null;
    const eventHour = event ? event.hour : null;

    const signals: string[] = [];
    if (ctitSeconds !== null && ctitSeconds < CONFIG.CTIT_CLICK_INJECT_S)
      signals.push("Click Injection (CTIT<10s)");
    if (ctitSeconds !== null && ctitSeconds > CONFIG.CTIT_CLICK_FLOOD_DAYS * 86400)
      signals.push("Click Flooding (CTIT>1d)");
    if (ip && ipMap[ip] >= CONFIG.IP_FARM_THRESHOLD) signals.push(`IP Farm (${ipMap[ip]} occurrences)`);
    if (deviceModelRaw && CONFIG.NULL_DEVICE_KEYWORDS.some((k) => deviceModel.includes(k)))
      signals.push("Unknown Device Model (Emulator)");
    if (isPrimaryRaw === "false" || String(isPrimaryRaw).toLowerCase() === "false")
      signals.push("Non-Primary Attribution (Assist Fraud)");
    if (gaid === CONFIG.GAID_ZERO) signals.push("Zeroed GAID (Device Farm/ID Spoof)");
    if (gaid && gaid !== CONFIG.GAID_ZERO && gaidMap[gaid] > 1) signals.push(`GAID Reuse (${gaidMap[gaid]}x)`);
    if (idfa && idfa.trim() !== "" && idfaMap[idfa] > 1) signals.push(`IDFA Reuse (${idfaMap[idfa]}x)`);
    if (country && country !== settings.targetCountry) signals.push(`Geo Mismatch (Country: ${country})`);
    if (country === settings.targetCountry && carrier) {
      const carrierNorm = carrier.trim().toLowerCase();
      if (!knownCarriersLower.some((k) => k && (carrierNorm.includes(k) || k.includes(carrierNorm))))
        signals.push(`Country/Carrier Mismatch (${carrier} unexpected for ${country})`);
    }
    if (ip && carrier && carrierIpMap[ip + "|" + carrier] >= settings.carrierIpThreshold)
      signals.push(`Carrier IP Concentration (${carrierIpMap[ip + "|" + carrier]} occurrences)`);
    const osNum = parseInt(osVersion, 10);
    if (!isNaN(osNum) && osNum <= 9) signals.push(`Outdated OS (Android ${osVersion})`);
    if (deviceModelRaw && deviceModelMap[deviceModel] >= settings.deviceModelClusterThreshold)
      signals.push(`Device Model Cluster (${deviceModelMap[deviceModel]}x)`);
    const sdkMode = sdkModeBySource[mediaSource];
    if (sdkMode && sdkVersion && String(sdkVersion) !== String(sdkMode.mode))
      signals.push(`SDK Version Mismatch (expected ${sdkMode.mode})`);
    const refHour = eventHour !== null ? eventHour : installHour;
    if (refHour !== null && (totalBySource[mediaSource] || 0) >= settings.timeOfDayMinSample) {
      const hrPct = ((hourBySource[mediaSource]?.[refHour] || 0) / totalBySource[mediaSource]) * 100;
      if (hrPct >= settings.timeOfDayThresholdPct)
        signals.push(`Time-of-Day Cluster (Hour ${refHour}:00 IST, ${hrPct.toFixed(0)}% of source)`);
    }
    if (fraudReason) signals.push(`PAF: ${fraudReason}${fraudSub ? " / " + fraudSub : ""}`);

    let fraudCategory = "Unknown";
    if (fraudReason === "click_flood" || fraudReason === "install_hijacking") fraudCategory = "Clicks";
    else if (fraudReason === "bots") fraudCategory = "Bots";
    else if (signals.length > 0) fraudCategory = "Signals Only";

    return {
      rowIndex: i,
      appsflyerId,
      installHour,
      eventHour,
      ctitSeconds,
      ctitMinutes: ctitSeconds !== null ? ctitSeconds / 60 : null,
      ctitHours: ctitSeconds !== null ? ctitSeconds / 3600 : null,
      installTimeMs: install ? install.ms : null,
      eventTimeMs: event ? event.ms : null,
      ip,
      ipCount: ipMap[ip] || 0,
      gaid,
      gaidCount: gaid ? gaidMap[gaid] || 0 : 0,
      idfa,
      mediaSource,
      siteId,
      campaign,
      country,
      carrier,
      osVersion,
      sdkVersion,
      deviceModel: deviceModelRaw,
      eventName,
      fraudReason: fraudReason || "",
      fraudSub: fraudSub || "",
      isPrimary: isPrimaryRaw,
      signals,
      fraudCategory,
      signalCount: signals.length,
      date: install ? install.date : event ? event.date : "",
    };
  });
}

export function computeEventSpecificFraud(
  enrichedEvents: EnrichedRow[],
  settings: Settings,
): { perInstallFlags: Record<string, PerInstallFlag>; funnel: { events: string[]; counts: number[] } } {
  const eventsByAfId: Record<string, EnrichedRow[]> = {};
  const funnelEvents = settings.funnelEvents || [];
  const stageIndexMap: Record<string, number> = {};
  funnelEvents.forEach((name, i) => (stageIndexMap[name] = i));
  const funnelStageCounts = funnelEvents.map(() => 0);
  const bucketSec = settings.uniformTimingBucketSeconds || 5;
  const deltaBucketMap: Record<string, number> = {};
  const perInstallFlags: Record<string, PerInstallFlag> = {};
  const installByAfId: Record<string, number> = {};

  enrichedEvents.forEach((e) => {
    if (!e.appsflyerId) return;
    if (e.installTimeMs && !installByAfId[e.appsflyerId]) installByAfId[e.appsflyerId] = e.installTimeMs;
    if (!eventsByAfId[e.appsflyerId]) eventsByAfId[e.appsflyerId] = [];
    eventsByAfId[e.appsflyerId].push(e);
  });

  Object.keys(eventsByAfId).forEach((afId) => {
    const evs = eventsByAfId[afId];
    const presentStages = new Set<number>();
    evs.forEach((e) => {
      if (e.eventName && stageIndexMap[e.eventName] !== undefined) presentStages.add(stageIndexMap[e.eventName]);
    });
    if (presentStages.size > 0) {
      const maxIdx = Math.max(...presentStages);
      funnelStageCounts[maxIdx]++;
      let missingDesc: string | null = null;
      for (let j = 0; j < maxIdx; j++) {
        if (!presentStages.has(j)) {
          missingDesc = `Missing "${funnelEvents[j]}" (stage ${j + 1}) but reached "${funnelEvents[maxIdx]}" (stage ${maxIdx + 1})`;
          break;
        }
      }
      if (missingDesc) {
        evs.forEach((e) => {
          e.signals.push(`Missing Funnel Event: ${missingDesc}`);
          if (e.fraudCategory === "Unknown") e.fraudCategory = "Signals Only";
          e.signalCount = e.signals.length;
        });
        if (!perInstallFlags[afId]) perInstallFlags[afId] = {};
        perInstallFlags[afId].missingFunnelDesc = missingDesc;
      }
    }
    evs.forEach((e) => {
      const installMs = e.installTimeMs || installByAfId[afId] || null;
      if (installMs && e.eventTimeMs) {
        const deltaSec = (e.eventTimeMs - installMs) / 1000;
        if (deltaSec >= 0) {
          const bucketed = Math.round(deltaSec / bucketSec) * bucketSec;
          const key = `${e.mediaSource}|${e.eventName}|${bucketed}`;
          deltaBucketMap[key] = (deltaBucketMap[key] || 0) + 1;
        }
      }
    });
  });

  Object.keys(eventsByAfId).forEach((afId) => {
    const evs = eventsByAfId[afId];
    let flaggedUniform = false;
    evs.forEach((e) => {
      const installMs = e.installTimeMs || installByAfId[afId] || null;
      if (installMs && e.eventTimeMs) {
        const deltaSec = (e.eventTimeMs - installMs) / 1000;
        if (deltaSec >= 0) {
          const bucketed = Math.round(deltaSec / bucketSec) * bucketSec;
          const key = `${e.mediaSource}|${e.eventName}|${bucketed}`;
          if (deltaBucketMap[key] >= settings.uniformTimingMinCount) {
            e.signals.push(`Uniform Install→Event Timing (~${bucketed}s)`);
            if (e.fraudCategory === "Unknown") e.fraudCategory = "Signals Only";
            e.signalCount = e.signals.length;
            flaggedUniform = true;
            if (!perInstallFlags[afId]) perInstallFlags[afId] = {};
            perInstallFlags[afId].uniformTiming = true;
            perInstallFlags[afId].uniformTimingDesc = `${deltaBucketMap[key]} events fired ~${bucketed}s post-install`;
          }
        }
      }
    });
    void flaggedUniform;
  });

  const cumulative = funnelStageCounts.map((_, i) => funnelStageCounts.slice(i).reduce((a, b) => a + b, 0));
  return { perInstallFlags, funnel: { events: funnelEvents, counts: cumulative } };
}

function createEmptyState(): DashboardState {
  return {
    total: 0,
    clickFlood: 0,
    hijack: 0,
    bots: 0,
    zeroGaid: 0,
    ctitHigh: 0,
    ctitLow: 0,
    deviceCluster: 0,
    timeOfDay: 0,
    sdkMismatch: 0,
    carrierMismatch: 0,
    zeroEvents: 0,
    missingFunnel: 0,
    uniformTiming: 0,
    byReason: {},
    bySubReason: {},
    byMedia: {},
    bySignal: {},
    bySiteId: {},
    ctitBuckets: { "Inject (<10s)": 0, "Suspicious (10s-1m)": 0, "Normal (1m-24h)": 0, "Flood (>24h)": 0 },
  };
}

function updateState(s: DashboardState, e: EnrichedRow, flags: PerInstallFlag | null) {
  s.total++;
  if (e.fraudReason === "click_flood") s.clickFlood++;
  if (e.fraudReason === "install_hijacking") s.hijack++;
  if (e.fraudReason === "bots") s.bots++;
  if (e.gaid === CONFIG.GAID_ZERO) s.zeroGaid++;
  if (e.ctitHours !== null && e.ctitHours > 24) s.ctitHigh++;
  if (e.ctitSeconds !== null && e.ctitSeconds < 10) s.ctitLow++;
  if (e.ctitSeconds !== null) {
    if (e.ctitSeconds < 10) s.ctitBuckets["Inject (<10s)"]++;
    else if (e.ctitSeconds < 60) s.ctitBuckets["Suspicious (10s-1m)"]++;
    else if ((e.ctitHours ?? 0) <= 24) s.ctitBuckets["Normal (1m-24h)"]++;
    else s.ctitBuckets["Flood (>24h)"]++;
  }
  if (e.signals.some((sig) => sig.startsWith("Device Model Cluster"))) s.deviceCluster++;
  if (e.signals.some((sig) => sig.startsWith("Time-of-Day Cluster"))) s.timeOfDay++;
  if (e.signals.some((sig) => sig.startsWith("SDK Version Mismatch"))) s.sdkMismatch++;
  if (e.signals.some((sig) => sig.startsWith("Country/Carrier Mismatch"))) s.carrierMismatch++;
  if (flags) {
    if (flags.zeroEvents) s.zeroEvents++;
    if (flags.missingFunnelDesc) s.missingFunnel++;
    if (flags.uniformTiming) s.uniformTiming++;
  }
  s.byReason[e.fraudReason || "clean"] = (s.byReason[e.fraudReason || "clean"] || 0) + 1;
  s.bySubReason[e.fraudSub || "none"] = (s.bySubReason[e.fraudSub || "none"] || 0) + 1;
  s.byMedia[e.mediaSource] = (s.byMedia[e.mediaSource] || 0) + 1;
  const sid = e.siteId ? String(e.siteId).trim() : "";
  if (sid && sid !== "(none)") s.bySiteId[sid] = (s.bySiteId[sid] || 0) + 1;
  e.signals.forEach((sig) => {
    const key = sig.replace(/\(\d+.*?\)/g, "").trim();
    s.bySignal[key] = (s.bySignal[key] || 0) + 1;
  });
}

function riskLevel(total: number, clickPct: number, bots: number): string {
  const botPct = total ? (bots / total) * 100 : 0;
  if (clickPct >= 50 || botPct >= 50 || (total >= 100 && clickPct >= 30)) return "Critical";
  if (clickPct >= 25 || botPct >= 25) return "High";
  if (clickPct >= 10 || botPct >= 10) return "Medium";
  return "Low";
}

function buildPublishers(enriched: EnrichedRow[]): PublisherRow[] {
  const map: Record<string, {
    mediaSource: string; sites: Set<string>; total: number; clickFlood: number;
    installHijack: number; bots: number; ctitSum: number; ctitCount: number; zeroGaid: number; outdatedOs: number;
  }> = {};
  enriched.forEach((e) => {
    const key = e.mediaSource;
    if (!map[key])
      map[key] = { mediaSource: key, sites: new Set(), total: 0, clickFlood: 0, installHijack: 0, bots: 0, ctitSum: 0, ctitCount: 0, zeroGaid: 0, outdatedOs: 0 };
    const p = map[key];
    p.total++;
    if (e.siteId && e.siteId !== "(none)") p.sites.add(e.siteId);
    if (e.fraudReason === "click_flood") p.clickFlood++;
    if (e.fraudReason === "install_hijacking") p.installHijack++;
    if (e.fraudReason === "bots") p.bots++;
    if (e.ctitSeconds !== null) {
      p.ctitSum += e.ctitSeconds;
      p.ctitCount++;
    }
    if (e.gaid === CONFIG.GAID_ZERO) p.zeroGaid++;
    const os = parseInt(e.osVersion, 10);
    if (!isNaN(os) && os <= 9) p.outdatedOs++;
  });
  return Object.values(map)
    .map((p) => {
      const clickPct = p.total ? ((p.clickFlood + p.installHijack) / p.total) * 100 : 0;
      return {
        mediaSource: p.mediaSource,
        siteCount: p.sites.size,
        total: p.total,
        clickFlood: p.clickFlood,
        installHijack: p.installHijack,
        bots: p.bots,
        clickPct,
        avgCtitMin: p.ctitCount > 0 ? p.ctitSum / p.ctitCount / 60 : null,
        zeroGaid: p.zeroGaid,
        outdatedOs: p.outdatedOs,
        risk: riskLevel(p.total, clickPct, p.bots),
      };
    })
    .sort((a, b) => b.total - a.total);
}

function buildDeviceModels(enriched: EnrichedRow[]): DeviceModelRow[] {
  const map: Record<string, { count: number; flagged: number }> = {};
  enriched.forEach((e) => {
    const m = (e.deviceModel || "").trim();
    if (!m) return;
    if (!map[m]) map[m] = { count: 0, flagged: 0 };
    map[m].count++;
    if (e.signalCount > 0) map[m].flagged++;
  });
  return Object.entries(map)
    .map(([model, v]) => ({ model, count: v.count, flagged: v.flagged }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

export function analyze(
  headers: string[],
  rows: Row[],
  mode: "Install" | "Event",
  settings: Settings,
  onProgress?: (p: number, msg: string) => void,
): AnalysisResult {
  onProgress?.(40, "Enriching rows & computing signals…");
  const enriched = enrichRows(headers, rows, settings);

  let perInstallFlags: Record<string, PerInstallFlag> = {};
  let funnel: { events: string[]; counts: number[] } | null = null;
  if (mode === "Event") {
    onProgress?.(60, "Analyzing event funnels & timing…");
    const r = computeEventSpecificFraud(enriched, settings);
    perInstallFlags = r.perInstallFlags;
    funnel = r.funnel;
  }

  onProgress?.(75, "Aggregating dashboard state…");
  const data: Record<string, DashboardState> = { All: createEmptyState() };
  const pids = [...new Set(enriched.map((e) => e.mediaSource))].filter(Boolean).sort();
  pids.forEach((pid) => (data[pid] = createEmptyState()));

  const processedAfIds = new Set<string>();
  enriched.forEach((e) => {
    const flags = mode === "Event" && !processedAfIds.has(e.appsflyerId) ? perInstallFlags[e.appsflyerId] || null : null;
    updateState(data.All, e, flags);
    if (data[e.mediaSource]) updateState(data[e.mediaSource], e, flags);
    processedAfIds.add(e.appsflyerId);
  });

  onProgress?.(88, "Building tables…");
  const publishers = buildPublishers(enriched);
  const deviceModels = buildDeviceModels(enriched);
  const flagged = enriched.filter((e) => e.signalCount > 0);

  const dates = enriched.map((e) => e.date).filter(Boolean).sort();
  const startDate = dates[0] || "";
  const endDate = dates[dates.length - 1] || "";

  // App name (best effort from first row)
  const idx = buildIndex(headers);
  const appName = rows.length ? getVal(rows[0], idx, COL.APP_NAME) || "App" : "App";

  onProgress?.(100, "Done");
  return {
    mode,
    appName: appName || "App",
    startDate,
    endDate,
    totalRows: enriched.length,
    flaggedRows: flagged.length,
    data,
    pids,
    publishers,
    deviceModels,
    flaggedInstalls: mode === "Install" ? flagged : [],
    flaggedEvents: mode === "Event" ? flagged : [],
    funnel,
    generatedAt: Date.now(),
  };
}