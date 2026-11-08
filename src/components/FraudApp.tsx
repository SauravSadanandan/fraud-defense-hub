import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { AuthGate } from "@/components/AuthGate";
import { Workspace } from "@/components/Workspace";
import { Dashboard } from "@/components/Dashboard";
import { DataBrowser } from "@/components/DataBrowser";
import type { AnalysisResult } from "@/engine/types";

function Shell() {
  const [mode, setMode] = useState<"Install" | "Event">("Install");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <button
            className="flex items-center gap-2.5"
            onClick={() => setResult(null)}
            aria-label="Home"
          >
            <BrandMark />
          </button>
          <div className="flex items-center gap-1">
            {result && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setResult(null)}>
                <Plus className="size-4" /> New analysis
              </Button>
            )}
            <DataBrowser
              refreshKey={refreshKey}
              onLoad={(r, label) => {
                setResult(r);
                setFileName(label);
              }}
            />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {result ? (
          <Dashboard
            result={result}
            fileName={fileName}
            onSaved={() => setRefreshKey((k) => k + 1)}
          />
        ) : (
          <Workspace
            mode={mode}
            setMode={setMode}
            onResult={(r, name) => {
              setResult(r);
              setFileName(name);
            }}
          />
        )}
      </main>
    </div>
  );
}

export function FraudApp() {
  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  );
}
