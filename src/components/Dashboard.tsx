import { useEffect, useMemo, useState } from "react";
import { Download, Save, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KpiCards } from "@/components/KpiCards";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DataTables } from "@/components/DataTables";
import { formatNumber } from "@/lib/format";
import { exportReport } from "@/lib/exportXlsx";
import { saveAnalysis } from "@/lib/firestore";
import { loadPublisherMap, setPublisher, publishersForApp, pubKey, type PublisherMap } from "@/lib/publishers";
import { resolveView } from "@/lib/aggregate";
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
  const [selection, setSelection] = useState("all");
  const [saving, setSaving] = useState(false);
  const [map, setMap] = useState<PublisherMap>({});
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValue, setTagValue] = useState("");

  useEffect(() => {
    setSelection("all");
  }, [result]);

  useEffect(() => {
    let active = true;
    void loadPublisherMap().then((m) => {
      if (active) setMap(m);
    });
    return () => {
      active = false;
    };
  }, [result]);

  const publishers = useMemo(
    () => publishersForApp(map, result.appName, result.pids),
    [map, result.appName, result.pids],
  );

  const view = useMemo(() => resolveView(result, map, selection), [result, map, selection]);
  const pidSet = view.scope === "all" ? null : new Set(view.pids);
  const activePid = selection.startsWith("pid:") ? selection.slice(4) : null;

  function onExport() {
    try {
      const name = exportReport(result, view.scope === "all" ? "all" : view.pids);
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
      toast.success("Saved to Firestore", { description: "Available in the Library." });
      onSaved?.();
    } else {
      toast.error("Could not save", {
        description: "Firestore unavailable. Configure firebase.ts to enable persistence.",
      });
    }
  }

  async function saveTag() {
    if (!activePid) return;
    const name = tagValue.trim();
    await setPublisher(result.appName, activePid, name);
    setMap((prev) => {
      const next = { ...prev };
      const key = pubKey(result.appName, activePid);
      if (name) next[key] = name;
      else delete next[key];
      return next;
    });
    setTagOpen(false);
    toast.success(name ? `Tagged ${activePid} → ${name}` : `Cleared publisher for ${activePid}`);
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
            {view.scope !== "all" && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {view.scope === "publisher" ? "Publisher" : "PID"}: {view.label}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {fileName} · {formatNumber(result.totalRows)} rows · {formatNumber(result.flaggedRows)} flagged
            {result.startDate && ` · ${result.startDate} → ${result.endDate}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selection} onValueChange={setSelection}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter view" />
            </SelectTrigger>
            <SelectContent className="max-h-[360px]">
              <SelectItem value="all">All media sources</SelectItem>
              {publishers.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Publishers</SelectLabel>
                  {publishers.map((p) => (
                    <SelectItem key={`pub:${p}`} value={`pub:${p}`}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              <SelectGroup>
                <SelectLabel>PIDs (Media Sources)</SelectLabel>
                {result.pids.map((pid) => {
                  const pub = map[pubKey(result.appName, pid)];
                  return (
                    <SelectItem key={`pid:${pid}`} value={`pid:${pid}`}>
                      {pid}
                      {pub ? ` · ${pub}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>

          {activePid && (
            <Popover
              open={tagOpen}
              onOpenChange={(o) => {
                setTagOpen(o);
                if (o) setTagValue(map[pubKey(result.appName, activePid)] || "");
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  <Tag className="size-4" /> Tag publisher
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div>
                  <div className="text-sm font-medium">Assign publisher</div>
                  <p className="text-xs text-muted-foreground">
                    For <span className="font-medium text-foreground">{activePid}</span> on {result.appName}. Saved per
                    app, so the same PID can map to a different publisher elsewhere.
                  </p>
                </div>
                <Input
                  list="publisher-suggestions"
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  placeholder="Publisher / broker name"
                  onKeyDown={(e) => e.key === "Enter" && saveTag()}
                />
                <datalist id="publisher-suggestions">
                  {publishers.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setTagOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveTag}>
                    Save
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button variant="outline" onClick={onSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
          <Button onClick={onExport} className="gap-1.5">
            <Download className="size-4" /> Export XLSX
          </Button>
        </div>
      </div>

      <KpiCards data={view.state} mode={result.mode} />
      <DashboardCharts data={view.state} scope={view.scope} label={view.label} />
      <DataTables result={result} state={view.state} pidSet={pidSet} />
    </div>
  );
}
