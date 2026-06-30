import { useState } from "react";
import { LogOut, Plus, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Login } from "@/components/Login";
import { Workspace } from "@/components/Workspace";
import { Dashboard } from "@/components/Dashboard";
import { HistoryPanel } from "@/components/HistoryPanel";
import { useAuth } from "@/lib/auth";
import type { AnalysisResult } from "@/engine/types";

function Shell() {
  const { user, logout } = useAuth();
  const [mode, setMode] = useState<"Install" | "Event">("Install");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const initials = (user?.name || "A").slice(0, 2).toUpperCase();

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
            <HistoryPanel
              refreshKey={refreshKey}
              onLoad={(r, label) => {
                setResult(r);
                setFileName(label);
              }}
            />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div className="font-medium">{user?.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {result ? (
          <Dashboard result={result} fileName={fileName} onSaved={() => setRefreshKey((k) => k + 1)} />
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
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  return user ? <Shell /> : <Login />;
}