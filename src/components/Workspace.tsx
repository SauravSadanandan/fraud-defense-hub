import { useEffect, useMemo, useState } from "react";
import { FolderTree, Loader2, ShieldAlert } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dropzone } from "@/components/Dropzone";
import { listAnalyses, loadAnalysis, type DatasetMeta } from "@/lib/firestore";
import { formatNumber } from "@/lib/format";
import type { AnalysisResult } from "@/engine/types";

const FEATURES = [
  { t: "Click fraud", d: "CTIT injection (<10s) & flooding (>1d)" },
  { t: "Bot detection", d: "Device & time-of-day clustering, GAID reuse" },
  { t: "Event integrity", d: "Funnel gaps, uniform timing, zero events" },
];

export function Workspace({
  mode,
  setMode,
  onResult,
}: {
  mode: "Install" | "Event";
  setMode: (m: "Install" | "Event") => void;
  onResult: (r: AnalysisResult, fileName: string) => void;
}) {
  const [recent, setRecent] = useState<DatasetMeta[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAnalyses().then((list) => {
      if (active) {
        setRecent(list);
        setLoadingRecent(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const apps = useMemo(() => {
    const byApp: Record<string, { appName: string; count: number; flagged: number; latest: DatasetMeta }> = {};
    recent.forEach((it) => {
      const key = it.appName || "App";
      if (!byApp[key]) byApp[key] = { appName: key, count: 0, flagged: 0, latest: it };
      byApp[key].count++;
      byApp[key].flagged += it.flaggedRows;
      if (it.generatedAt > byApp[key].latest.generatedAt) byApp[key].latest = it;
    });
    return Object.values(byApp).sort((a, b) => b.latest.generatedAt - a.latest.generatedAt);
  }, [recent]);

  async function openApp(meta: DatasetMeta) {
    setBusyId(meta.id);
    const r = await loadAnalysis(meta.id);
    setBusyId(null);
    if (r) onResult(r, meta.label);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Upload */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Upload AppsFlyer raw data</h1>
                <p className="text-xs text-muted-foreground">Processed locally in your browser — handles 50k+ rows.</p>
              </div>
              <Tabs value={mode} onValueChange={(v) => setMode(v as "Install" | "Event")}>
                <TabsList>
                  <TabsTrigger value="Install">Install</TabsTrigger>
                  <TabsTrigger value="Event">Event</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Dropzone mode={mode} onResult={onResult} />
          </div>
        </div>

        {/* Detection summary */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldAlert className="size-3.5" /> What the engine detects
          </div>
          {FEATURES.map((c) => (
            <div key={c.t} className="rounded-xl border border-border bg-card p-3">
              <div className="text-sm font-semibold">{c.t}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent apps */}
      {(loadingRecent || apps.length > 0) && (
        <div>
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <FolderTree className="size-4 text-primary" /> Your apps
            <span className="text-xs font-normal text-muted-foreground">— open a saved analysis</span>
          </div>
          {loadingRecent ? (
            <div className="flex items-center justify-center rounded-2xl border border-border py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((a) => (
                <button
                  key={a.appName}
                  onClick={() => openApp(a.latest)}
                  disabled={busyId === a.latest.id}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{a.appName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.count} report{a.count > 1 ? "s" : ""} · {formatNumber(a.flagged)} flagged ·{" "}
                      {(a.latest.pids || []).length} PIDs
                    </div>
                  </div>
                  {busyId === a.latest.id ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="shrink-0 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Open
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
