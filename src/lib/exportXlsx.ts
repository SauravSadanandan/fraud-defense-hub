import * as XLSX from "xlsx";
import type { AnalysisResult, EnrichedRow, DashboardState } from "@/engine/types";

function sanitize(part: string): string {
  return (part || "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "NA";
}

export function buildFileName(result: AnalysisResult, publisher: string): string {
  const app = sanitize(result.appName);
  const pub = publisher === "All" ? "All" : sanitize(publisher);
  const range = result.startDate && result.endDate ? `${result.startDate}_to_${result.endDate}` : "report";
  return `${app}_${pub}_${range}.xlsx`;
}

function stateToRows(state: DashboardState, label: string): unknown[][] {
  const clickFraud = state.clickFlood + state.hijack;
  return [
    [`Summary — ${label}`],
    ["Metric", "Count"],
    ["Total Flagged Rows", state.total],
    ["Click Fraud (Flood + Hijack)", clickFraud],
    ["Bots / AI Layer", state.bots],
    ["Zeroed GAID", state.zeroGaid],
    ["CTIT > 1 day", state.ctitHigh],
    ["CTIT < 10s", state.ctitLow],
    ["Device Model Cluster", state.deviceCluster],
    ["Time-of-Day Cluster", state.timeOfDay],
    ["SDK Mismatch", state.sdkMismatch],
    ["Carrier Mismatch", state.carrierMismatch],
    ["Zero Events Post-Install", state.zeroEvents],
    ["Missing Funnel Event", state.missingFunnel],
    ["Uniform Event Timing", state.uniformTiming],
  ];
}

function flaggedToRows(rows: EnrichedRow[]): unknown[][] {
  const header = [
    "AppsFlyer ID", "Media Source", "Site ID", "Campaign", "Event Name", "Country",
    "Carrier", "Device Model", "OS", "CTIT (min)", "Fraud Reason", "Fraud Category",
    "Signal Count", "Signals",
  ];
  const body = rows.map((e) => [
    e.appsflyerId, e.mediaSource, e.siteId, e.campaign, e.eventName, e.country,
    e.carrier, e.deviceModel, e.osVersion,
    e.ctitMinutes !== null ? Number(e.ctitMinutes.toFixed(2)) : "—",
    e.fraudReason, e.fraudCategory, e.signalCount, e.signals.join(" | "),
  ]);
  return [header, ...body];
}

function aoaSheet(wb: XLSX.WorkBook, name: string, aoa: unknown[][]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

// Export modes: "all", or a list of specific PIDs.
export function exportReport(result: AnalysisResult, pids: string[] | "all") {
  const wb = XLSX.utils.book_new();
  const isAll = pids === "all";
  const selected = isAll ? ["All"] : pids;

  // Dashboard summary sheet
  const summaryAoa: unknown[][] = [];
  selected.forEach((pid) => {
    const state = result.data[pid];
    if (state) {
      summaryAoa.push(...stateToRows(state, pid));
      summaryAoa.push([]);
    }
  });
  aoaSheet(wb, "Dashboard", summaryAoa.length ? summaryAoa : [["No data"]]);

  // Signals breakdown (from the "All" or first selected state)
  const baseState = result.data[isAll ? "All" : selected[0]] || result.data.All;
  if (baseState) {
    const sigAoa: unknown[][] = [["Signal", "Count", "% of Total"]];
    Object.entries(baseState.bySignal)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => sigAoa.push([k, v, baseState.total ? `${((v / baseState.total) * 100).toFixed(1)}%` : "0%"]));
    aoaSheet(wb, "Fraud Signals", sigAoa);

    const reasonAoa: unknown[][] = [["Fraud Reason", "Count"]];
    Object.entries(baseState.byReason).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => reasonAoa.push([k, v]));
    aoaSheet(wb, "Fraud Reasons", reasonAoa);
  }

  // Publisher analysis
  const pubHeader = [
    "Media Source", "Unique Site IDs", "Total Flagged", "Click Flood", "Install Hijack",
    "Bots", "Click Fraud %", "Avg CTIT (min)", "Zeroed GAID", "Outdated OS", "Risk Level",
  ];
  const pubRows = result.publishers
    .filter((p) => isAll || selected.includes(p.mediaSource))
    .map((p) => [
      p.mediaSource, p.siteCount, p.total, p.clickFlood, p.installHijack, p.bots,
      `${p.clickPct.toFixed(1)}%`, p.avgCtitMin !== null ? Number(p.avgCtitMin.toFixed(1)) : "—",
      p.zeroGaid, p.outdatedOs, p.risk,
    ]);
  aoaSheet(wb, "Publisher Analysis", [pubHeader, ...pubRows]);

  // Device models
  aoaSheet(wb, "Device Models", [["Device Model", "Count", "Flagged"], ...result.deviceModels.map((d) => [d.model, d.count, d.flagged])]);

  // Flagged rows (filtered by PID when not all)
  const flagged = result.mode === "Event" ? result.flaggedEvents : result.flaggedInstalls;
  const filteredFlagged = isAll ? flagged : flagged.filter((e) => selected.includes(e.mediaSource));
  aoaSheet(wb, result.mode === "Event" ? "Flagged Events" : "Flagged Installs", flaggedToRows(filteredFlagged));

  if (result.funnel && result.funnel.events.length) {
    aoaSheet(wb, "Event Funnel", [
      ["Stage", "Event", "Reached (cumulative)"],
      ...result.funnel.events.map((ev, i) => [i + 1, ev, result.funnel!.counts[i]]),
    ]);
  }

  const fileName = buildFileName(result, isAll ? "All" : selected.length === 1 ? selected[0] : "Multiple");
  XLSX.writeFile(wb, fileName);
  return fileName;
}