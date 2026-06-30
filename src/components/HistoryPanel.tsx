import { useEffect, useState } from "react";
import { History, Loader2, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { listAnalyses, loadAnalysis, deleteAnalysis, type DatasetMeta } from "@/lib/firestore";
import type { AnalysisResult } from "@/engine/types";

export function HistoryPanel({
  refreshKey,
  onLoad,
}: {
  refreshKey: number;
  onLoad: (r: AnalysisResult, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DatasetMeta[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const list = await listAnalyses();
    setItems(list);
    setLoading(false);
  }

  useEffect(() => {
    if (open) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshKey]);

  async function handleLoad(meta: DatasetMeta) {
    setBusyId(meta.id);
    const r = await loadAnalysis(meta.id);
    setBusyId(null);
    if (r) {
      onLoad(r, meta.label);
      setOpen(false);
      toast.success("Loaded saved analysis");
    } else {
      toast.error("Could not load analysis");
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const ok = await deleteAnalysis(id);
    setBusyId(null);
    if (ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Deleted");
    } else {
      toast.error("Could not delete");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <History className="size-4" /> History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Saved analyses</SheetTitle>
          <SheetDescription>Reports persisted to Firestore.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto px-4 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No saved analyses yet. Run an analysis and click <span className="font-medium">Save</span>.
            </div>
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-accent/40"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <FileSpreadsheet className="size-4" />
                </span>
                <button className="min-w-0 flex-1 text-left" onClick={() => handleLoad(it)} disabled={busyId === it.id}>
                  <div className="truncate text-sm font-medium">{it.appName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {it.mode} · {formatNumber(it.flaggedRows)} flagged ·{" "}
                    {new Date(it.generatedAt).toLocaleDateString()}
                  </div>
                </button>
                {busyId === it.id ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(it.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}