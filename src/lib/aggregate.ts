import type { AnalysisResult, DashboardState } from "@/engine/types";
import { pubKey, type PublisherMap } from "./publishers";

const NUM_KEYS = [
  "total", "clickFlood", "hijack", "bots", "zeroGaid", "ctitHigh", "ctitLow",
  "deviceCluster", "timeOfDay", "sdkMismatch", "carrierMismatch", "zeroEvents",
  "missingFunnel", "uniformTiming",
] as const;

const REC_KEYS = ["byReason", "bySubReason", "byMedia", "bySignal", "bySiteId", "ctitBuckets"] as const;

export function emptyState(): DashboardState {
  return {
    total: 0, clickFlood: 0, hijack: 0, bots: 0, zeroGaid: 0, ctitHigh: 0, ctitLow: 0,
    deviceCluster: 0, timeOfDay: 0, sdkMismatch: 0, carrierMismatch: 0, zeroEvents: 0,
    missingFunnel: 0, uniformTiming: 0,
    byReason: {}, bySubReason: {}, byMedia: {}, bySignal: {}, bySiteId: {},
    ctitBuckets: { "Inject (<10s)": 0, "Suspicious (10s-1m)": 0, "Normal (1m-24h)": 0, "Flood (>24h)": 0 },
  };
}

// Per-pid states are additive (each row belongs to exactly one media source),
// so summing them is exact.
export function mergeStates(states: (DashboardState | undefined)[]): DashboardState {
  const out = emptyState();
  for (const s of states) {
    if (!s) continue;
    for (const k of NUM_KEYS) out[k] += s[k] || 0;
    for (const rk of REC_KEYS) {
      const src = s[rk] || {};
      for (const [k, v] of Object.entries(src)) out[rk][k] = (out[rk][k] || 0) + (v as number);
    }
  }
  return out;
}

export type ViewScope = "all" | "publisher" | "pid";

export interface ResolvedView {
  scope: ViewScope;
  label: string;
  pids: string[];
  state: DashboardState;
}

// selection: "all" | `pub:<name>` | `pid:<pid>`
export function resolveView(result: AnalysisResult, map: PublisherMap, selection: string): ResolvedView {
  if (!selection || selection === "all") {
    return { scope: "all", label: "All media sources", pids: result.pids, state: result.data.All };
  }
  if (selection.startsWith("pub:")) {
    const name = selection.slice(4);
    const pids = result.pids.filter((p) => (map[pubKey(result.appName, p)] || "") === name);
    return {
      scope: "publisher",
      label: name,
      pids,
      state: mergeStates(pids.map((p) => result.data[p])),
    };
  }
  const pid = selection.startsWith("pid:") ? selection.slice(4) : selection;
  return {
    scope: "pid",
    label: pid,
    pids: [pid],
    state: result.data[pid] || emptyState(),
  };
}
