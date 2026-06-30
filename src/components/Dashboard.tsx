import { useMemo, useState } from "react";
import { Download, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCards } from "@/components/KpiCards";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DataTables } from "@/components/DataTables";
import { formatNumber } from "@/lib/format";
import { exportReport } from "@/lib/exportXlsx";
import { saveAnalysis } from "@/lib/firestore";
import type { AnalysisResult } from "@/engine/types";

export function Dashboard({
  result,
  fileName,
  onSaved,
}: {
  result: AnalysisResult;
  fileName: string;
  onSaved?: () => void;
}) {
  const [selectedPid, setSelectedPid] = useState("All");
  const [saving, setSaving] = useState(false);

  const state = useMemo(
    () => result.data[selectedPid] || result.data.All,
    [result, selectedPid],
  );

  function onExport() {
    try {
      const name = exportReport(result, selectedPid === "All" ? "all" : [selectedPid]);
      toast.success("Report exported", { description: name });
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  async function onSave() {
    setSaving(true);
    const label = `${result.appName} · ${result.mode} · ${fileName}`;
    const id = await saveAnalysis(result, label);
    setSaving(false);
    if (id) {
      toast.success("Saved to Firestore", { description: "Available in History." });
      onSaved?.();
    } else {
      toast.error("Could not save", {
        description: "Firestore unavailable. Configure firebase.ts to enable persistence.",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight">{result.appName}</h2>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
              {result.mode} mode
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {fileName} · {formatNumber(result.totalRows)} rows · {formatNumber(result.flaggedRows)} flagged
            {result.startDate && ` · ${result.startDate} → ${result.endDate}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedPid} onValueChange={setSelectedPid}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Media source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All media sources</SelectItem>
              {result.pids.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={onSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
          <Button onClick={onExport} className="gap-1.5">
            <Download className="size-4" /> Export XLSX
          </Button>
        </div>
      </div>

      <KpiCards data={state} mode={result.mode} />
      <DashboardCharts data={state} selectedPid={selectedPid} />
      <DataTables result={result} state={state} selectedPid={selectedPid} />
    </div>
  );
}