import { formatMetric } from "@/lib/format";
import type { DashboardState } from "@/engine/types";
import { cn } from "@/lib/utils";

interface Kpi {
  label: string;
  value: number;
  tone: "click" | "bot" | "hijack" | "warn" | "neutral";
}

const toneClass: Record<Kpi["tone"], string> = {
  click: "text-fraud-click",
  bot: "text-fraud-bot",
  hijack: "text-fraud-hijack",
  warn: "text-fraud-warn",
  neutral: "text-foreground",
};

const dotClass: Record<Kpi["tone"], string> = {
  click: "bg-fraud-click",
  bot: "bg-fraud-bot",
  hijack: "bg-fraud-hijack",
  warn: "bg-fraud-warn",
  neutral: "bg-muted-foreground",
};

export function KpiCards({ data, mode }: { data: DashboardState; mode: "Install" | "Event" }) {
  const clickFraud = data.clickFlood + data.hijack;
  const kpis: Kpi[] = [
    { label: "Total Flagged", value: data.total, tone: "neutral" },
    { label: "Click Fraud", value: clickFraud, tone: "click" },
    { label: "Bots / AI Layer", value: data.bots, tone: "bot" },
    { label: "Zeroed GAID", value: data.zeroGaid, tone: "bot" },
    { label: "CTIT > 1 day", value: data.ctitHigh, tone: "click" },
    { label: "CTIT < 10s", value: data.ctitLow, tone: "click" },
    { label: "Device Cluster", value: data.deviceCluster, tone: "bot" },
    { label: "Time-of-Day Cluster", value: data.timeOfDay, tone: "bot" },
    { label: "SDK Mismatch", value: data.sdkMismatch, tone: "warn" },
    { label: "Carrier Mismatch", value: data.carrierMismatch, tone: "warn" },
  ];
  if (mode === "Event") {
    kpis.push(
      { label: "Zero Events", value: data.zeroEvents, tone: "bot" },
      { label: "Missing Funnel", value: data.missingFunnel, tone: "hijack" },
      { label: "Uniform Timing", value: data.uniformTiming, tone: "hijack" },
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", dotClass[k.tone])} />
            <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
          </div>
          <div className={cn("mt-2 text-2xl font-semibold tracking-tight", toneClass[k.tone])}>
            {formatMetric(k.value)}
          </div>
        </div>
      ))}
    </div>
  );
}