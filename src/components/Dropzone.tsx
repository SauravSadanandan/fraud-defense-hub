import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { runAnalysis } from "@/lib/runAnalysis";
import { DEFAULT_SETTINGS } from "@/engine/config";
import type { AnalysisResult } from "@/engine/types";

export function Dropzone({
  mode,
  onResult,
}: {
  mode: "Install" | "Event";
  onResult: (r: AnalysisResult, fileName: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
        toast.error("Unsupported file", { description: "Please upload a .csv or .xlsx file." });
        return;
      }
      setBusy(true);
      setFileName(file.name);
      setProgress(5);
      setStatusMsg("Starting…");
      try {
        const result = await runAnalysis(file, mode, DEFAULT_SETTINGS, (p, m) => {
          setProgress(p);
          setStatusMsg(m);
        });
        toast.success("Analysis complete", {
          description: `${result.flaggedRows.toLocaleString()} flagged of ${result.totalRows.toLocaleString()} rows.`,
        });
        onResult(result, file.name);
      } catch (err) {
        toast.error("Could not process file", {
          description: err instanceof Error ? err.message : "Unexpected error while parsing.",
        });
      } finally {
        setBusy(false);
        setProgress(0);
        setStatusMsg("");
      }
    },
    [mode, onResult],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (busy) return;
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 px-6 py-12 text-center transition-colors",
        dragging && "border-primary bg-accent/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {busy ? (
        <div className="w-full max-w-sm">
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-primary" />
          <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium">
            <FileSpreadsheet className="size-4" /> {fileName}
          </div>
          <Progress value={progress} className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">{statusMsg}</p>
        </div>
      ) : (
        <>
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <UploadCloud className="size-7" />
          </span>
          <h3 className="text-base font-semibold">Drag & drop your {mode} raw data</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Accepts <span className="font-medium text-foreground">.csv</span> and{" "}
            <span className="font-medium text-foreground">.xlsx</span> AppsFlyer exports. Handles 50k+ rows off the main
            thread.
          </p>
          <Button className="mt-5" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
        </>
      )}
    </div>
  );
}

export function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClear} className="gap-1.5">
      <X className="size-4" /> Clear data
    </Button>
  );
}