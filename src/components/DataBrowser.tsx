import { useEffect, useMemo, useState } from "react";
import { FolderTree, Loader2, Trash2, FileSpreadsheet, ChevronRight, Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { listAnalyses, loadAnalysis, deleteAnalysis, type DatasetMeta } from "@/lib/firestore";
import { loadPublisherMap, setPublisher, pubKey, type PublisherMap } from "@/lib/publishers";
import type { AnalysisResult } from "@/engine/types";

interface AppGroup {
  appName: string;
  datasets: DatasetMeta[];
  pids: string[];
}

export function DataBrowser({
  refreshKey,
  onLoad,
}: {
  refreshKey: number;
  onLoad: (r: AnalysisResult, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DatasetMeta[]>([]);
  const [map, setMap] = useState<PublisherMap>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // pubKey being edited
  const [editValue, setEditValue] = useState("");

  async function refresh() {
    setLoading(true);
    const [list, m] = await Promise.all([listAnalyses(), loadPublisherMap()]);
    setItems(list);
    setMap(m);
    setLoading(false);
  }

  useEffect(() => {
    if (open) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshKey]);

  const groups = useMemo<AppGroup[]>(() => {
    const byApp: Record<string, AppGroup> = {};
    items.forEach((it) => {
      const key = it.appName || "App";
      if (!byApp[key]) byApp[key] = { appName: key, datasets: [], pids: [] };
      byApp[key].datasets.push(it);
    });
    Object.values(byApp).forEach((g) => {
      const pidSet = new Set<string>();
      g.datasets.forEach((d) => (d.pids || []).forEach((p) => pidSet.add(p)));
      g.pids = [...pidSet].sort((a, b) => a.localeCompare(b));
    });
    return Object.values(byApp).sort((a, b) => a.appName.localeCompare(b.appName));
  }, [items]);

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

  async function saveTag(appName: string, pid: string) {
    const key = pubKey(appName, pid);
    const name = editValue.trim();
    await setPublisher(appName, pid, name);
    setMap((prev) => {
      const next = { ...prev };
      if (name) next[key] = name;
      else delete next[key];
      return next;
    });
    setEditing(null);
    toast.success(name ? `Tagged ${pid} → ${name}` : `Cleared publisher for ${pid}`);
  }

  function publisherGroups(g: AppGroup) {
    const out: Record<string, string[]> = {};
    g.pids.forEach((pid) => {
      const pub = map[pubKey(g.appName, pid)] || "Unassigned";
      if (!out[pub]) out[pub] = [];
      out[pub].push(pid);
    });
    return Object.entries(out).sort((a, b) => {
      if (a[0] === "Unassigned") return 1;
      if (b[0] === "Unassigned") return -1;
      return a[0].localeCompare(b[0]);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <FolderTree className="size-4" /> Library
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Data library</SheetTitle>
          <SheetDescription>Browse by App → Publisher → PID. Load saved analyses and tag publishers.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex-1 space-y-3 overflow-y-auto px-4 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No saved analyses yet. Run an analysis and click <span className="font-medium">Save</span>.
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {groups.map((g) => (
                <AccordionItem
                  key={g.appName}
                  value={g.appName}
                  className="rounded-xl border border-border px-3"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex min-w-0 items-center gap-2 text-left">
                      <span className="truncate text-sm font-semibold">{g.appName}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                        {g.datasets.length} report{g.datasets.length > 1 ? "s" : ""} · {g.pids.length} PIDs
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-3">
                    {/* Datasets */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground">Saved reports</div>
                      {g.datasets.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center gap-2 rounded-lg border border-border p-2 transition-colors hover:bg-accent/40"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                            <FileSpreadsheet className="size-4" />
                          </span>
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => handleLoad(it)}
                            disabled={busyId === it.id}
                          >
                            <div className="truncate text-xs font-medium">
                              {it.mode} · {formatNumber(it.flaggedRows)} flagged
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {new Date(it.generatedAt).toLocaleString()}
                            </div>
                          </button>
                          {busyId === it.id ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(it.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Publishers → PIDs */}
                    {g.pids.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Publishers &amp; PIDs</div>
                        {publisherGroups(g).map(([pub, pids]) => (
                          <div key={pub} className="rounded-lg bg-muted/40 p-2">
                            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  pub === "Unassigned" ? "bg-muted-foreground" : "bg-primary",
                                )}
                              />
                              {pub}
                              <span className="font-normal text-muted-foreground">({pids.length})</span>
                            </div>
                            <div className="space-y-1">
                              {pids.map((pid) => {
                                const key = pubKey(g.appName, pid);
                                const isEditing = editing === key;
                                return (
                                  <div key={pid} className="flex items-center gap-1.5 pl-3 text-xs">
                                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                                    {isEditing ? (
                                      <div className="flex flex-1 items-center gap-1">
                                        <Input
                                          autoFocus
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onKeyDown={(e) => e.key === "Enter" && saveTag(g.appName, pid)}
                                          placeholder="Publisher name"
                                          className="h-7 text-xs"
                                        />
                                        <Button size="sm" className="h-7 px-2" onClick={() => saveTag(g.appName, pid)}>
                                          Save
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="min-w-0 flex-1 truncate font-mono">{pid}</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-6 text-muted-foreground"
                                          onClick={() => {
                                            setEditing(key);
                                            setEditValue(map[key] || "");
                                          }}
                                        >
                                          <Pencil className="size-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
