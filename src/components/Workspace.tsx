import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dropzone } from "@/components/Dropzone";
import type { AnalysisResult } from "@/engine/types";

export function Workspace({
  mode,
  setMode,
  onResult,
}: {
  mode: "Install" | "Event";
  setMode: (m: "Install" | "Event") => void;
  onResult: (r: AnalysisResult, fileName: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Upload AppsFlyer raw data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the PAF fraud engine across installs or in-app events. Processing happens locally in your browser.
        </p>
      </div>

      <div className="mb-5 flex justify-center">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "Install" | "Event")}>
          <TabsList>
            <TabsTrigger value="Install">Install analysis</TabsTrigger>
            <TabsTrigger value="Event">Event analysis</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Dropzone mode={mode} onResult={onResult} />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { t: "Click fraud", d: "CTIT injection (<10s) & flooding (>1d)" },
          { t: "Bot detection", d: "Device & time-of-day clustering, GAID reuse" },
          { t: "Event integrity", d: "Funnel gaps, uniform timing, zero events" },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">{c.t}</div>
            <div className="mt-1 text-xs text-muted-foreground">{c.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}