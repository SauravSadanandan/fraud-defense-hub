import { useEffect, useState, useMemo } from "react";
import {
  Sliders,
  Play,
  Loader2,
  FileSpreadsheet,
  Globe,
  Radio,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeoRulesEditor } from "./profiles/GeoRulesEditor";
import { FunnelEditor } from "./profiles/FunnelEditor";
import { ThresholdsFields } from "./profiles/ThresholdsFields";
import {
  listProfiles,
  getLastProfileId,
  setLastProfileId,
  type CampaignProfile,
  BUILTIN_INDIA,
} from "@/lib/profiles";
import type { AnalysisSession } from "@/lib/runAnalysis";
import type { Settings } from "@/engine/config";

interface RunConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  session: AnalysisSession | null;
  initialMode: "Install" | "Event";
  onRun: (
    mode: "Install" | "Event",
    settings: Settings,
    profileMeta: { id?: string; name?: string },
  ) => Promise<void>;
  running: boolean;
  progress: number;
  statusMsg: string;
}

export function RunConfigDialog({
  open,
  onOpenChange,
  fileName,
  session,
  initialMode,
  onRun,
  running,
  progress,
  statusMsg,
}: RunConfigDialogProps) {
  const [profiles, setProfiles] = useState<CampaignProfile[]>([BUILTIN_INDIA]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(getLastProfileId());
  const [selectedMode, setSelectedMode] = useState<"Install" | "Event">(initialMode);
  const [customizing, setCustomizing] = useState(false);
  const [customSettings, setCustomSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (open) {
      void listProfiles().then((list) => {
        setProfiles(list);
        const lastId = getLastProfileId();
        const exists = list.some((p) => p.id === lastId);
        setSelectedProfileId(exists ? lastId : list[0]?.id || BUILTIN_INDIA.id);
      });
      if (session) {
        setSelectedMode(session.scan.detectedMode || initialMode);
      }
      setCustomizing(false);
      setCustomSettings(null);
    }
  }, [open, session, initialMode]);

  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId) || profiles[0] || BUILTIN_INDIA;
  }, [profiles, selectedProfileId]);

  const effectiveSettings: Settings = useMemo(() => {
    if (customizing && customSettings) {
      return customSettings;
    }
    return activeProfile.settings;
  }, [customizing, customSettings, activeProfile]);

  const scan = session?.scan;

  // Auto-detect suggestion
  const suggestedProfileId = useMemo(() => {
    if (!scan || !scan.countries.length) return null;
    const topCountry = scan.countries[0]?.country;
    if (topCountry === "IN") return "builtin:india-default";
    const matched = profiles.find((p) =>
      p.settings.geos.some((g) => g.country.toUpperCase() === topCountry),
    );
    return matched ? matched.id : "builtin:blank";
  }, [scan, profiles]);

  const handleProfileChange = (newId: string) => {
    setSelectedProfileId(newId);
    setLastProfileId(newId);
    setCustomizing(false);
    setCustomSettings(null);
  };

  const handleStartCustomizing = () => {
    if (!customSettings) {
      setCustomSettings(JSON.parse(JSON.stringify(activeProfile.settings)));
    }
    setCustomizing(true);
  };

  const handleExecute = async () => {
    setLastProfileId(selectedProfileId);
    await onRun(selectedMode, effectiveSettings, {
      id: customizing ? undefined : activeProfile.id,
      name: customizing ? `${activeProfile.name} (Customized)` : activeProfile.name,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!running) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="size-5 text-primary" />
            Configure Fraud Analysis
          </DialogTitle>
          <DialogDescription>
            Select detection profile and review auto-detected characteristics before running.
          </DialogDescription>
        </DialogHeader>

        {running ? (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Running Fraud Defense Engine…</h4>
              <p className="text-xs text-muted-foreground">{statusMsg || "Processing rows…"}</p>
            </div>
            <div className="max-w-md mx-auto">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* File & Scan Summary Card */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <FileSpreadsheet className="size-4 text-primary" />
                  {fileName}
                </span>
                <span className="font-mono text-muted-foreground">
                  {session?.rowCount.toLocaleString()} rows detected
                </span>
              </div>

              {scan && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-1">Detected Geos:</span>
                    {scan.countries.length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {scan.countries.slice(0, 4).map((c) => (
                          <Badge
                            key={c.country}
                            variant="secondary"
                            className="text-[11px] px-1.5 py-0"
                          >
                            {c.country} ({c.count})
                          </Badge>
                        ))}
                        {scan.countries.length > 4 && (
                          <span className="text-[11px] text-muted-foreground self-center">
                            +{scan.countries.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-muted-foreground block mb-1">Detected Mode:</span>
                    <Badge variant="outline" className="text-[11px] font-medium uppercase">
                      {scan.detectedMode} Mode
                    </Badge>
                    {scan.events.length > 0 && (
                      <span className="text-[11px] text-muted-foreground ml-2">
                        ({scan.events.length} unique events)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Run Mode Switcher */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Analysis Mode</Label>
                <p className="text-[11px] text-muted-foreground">
                  Choose Install attribution or Event conversion funnel analysis.
                </p>
              </div>
              <Tabs
                value={selectedMode}
                onValueChange={(v) => setSelectedMode(v as "Install" | "Event")}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="Install" className="text-xs">
                    Install
                  </TabsTrigger>
                  <TabsTrigger value="Event" className="text-xs">
                    Event
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Profile Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-select" className="text-xs font-medium">
                  Campaign Profile
                </Label>
                {suggestedProfileId && suggestedProfileId !== selectedProfileId && (
                  <button
                    type="button"
                    onClick={() => handleProfileChange(suggestedProfileId)}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <Sparkles className="size-3" />
                    Use suggested profile
                  </button>
                )}
              </div>

              <Select value={selectedProfileId} onValueChange={handleProfileChange}>
                <SelectTrigger id="profile-select" className="h-9 text-xs">
                  <SelectValue placeholder="Select a profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[11px]">Built-in Profiles</SelectLabel>
                    {profiles
                      .filter((p) => p.isBuiltin)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                  {profiles.some((p) => !p.isBuiltin) && (
                    <SelectGroup>
                      <SelectLabel className="text-[11px]">Custom Profiles</SelectLabel>
                      {profiles
                        .filter((p) => !p.isBuiltin)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Active Profile Configuration Summary */}
            <div className="rounded-xl border border-border p-3.5 bg-accent/20 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  Active Configuration
                  {customizing && (
                    <Badge variant="outline" className="text-[10px] text-primary">
                      Customized for this run
                    </Badge>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (customizing) {
                      setCustomizing(false);
                      setCustomSettings(null);
                    } else {
                      handleStartCustomizing();
                    }
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  {customizing ? (
                    <>
                      <ChevronUp className="size-3" /> Reset to Profile Defaults
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3" /> Customize for this run
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-muted-foreground pt-1">
                <div>
                  <span className="block text-[11px]">Target Geos:</span>
                  <span className="font-medium text-foreground">
                    {effectiveSettings.geos.length === 0
                      ? "Global"
                      : effectiveSettings.geos.map((g) => g.country).join(", ")}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px]">Funnel Stages:</span>
                  <span className="font-medium text-foreground">
                    {effectiveSettings.funnelStages.length || "None"}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px]">CTIT Inject / Flood:</span>
                  <span className="font-mono text-foreground">
                    &lt;{effectiveSettings.thresholds.ctitClickInjectSec}s / &gt;
                    {effectiveSettings.thresholds.ctitClickFloodDays}d
                  </span>
                </div>
                <div>
                  <span className="block text-[11px]">Timezone:</span>
                  <span className="font-medium text-foreground">
                    {effectiveSettings.timezoneLabel || "UTC"}
                  </span>
                </div>
              </div>

              {/* Inline Customizer Drawer/Panel */}
              {customizing && customSettings && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  <Tabs defaultValue="geos" className="w-full">
                    <TabsList className="grid grid-cols-3 h-8">
                      <TabsTrigger value="geos" className="text-xs">
                        Geos &amp; Carriers
                      </TabsTrigger>
                      <TabsTrigger value="funnel" className="text-xs">
                        Funnel
                      </TabsTrigger>
                      <TabsTrigger value="thresholds" className="text-xs">
                        Thresholds
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="geos" className="mt-3">
                      <GeoRulesEditor
                        value={customSettings.geos}
                        onChange={(geos) => setCustomSettings({ ...customSettings, geos })}
                      />
                    </TabsContent>
                    <TabsContent value="funnel" className="mt-3">
                      <FunnelEditor
                        value={customSettings.funnelStages}
                        onChange={(funnelStages) =>
                          setCustomSettings({ ...customSettings, funnelStages })
                        }
                      />
                    </TabsContent>
                    <TabsContent value="thresholds" className="mt-3">
                      <ThresholdsFields
                        value={customSettings.thresholds}
                        onChange={(thresholds) =>
                          setCustomSettings({ ...customSettings, thresholds })
                        }
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={running}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExecute}
                disabled={running}
                className="gap-1.5"
              >
                <Play className="size-3.5 fill-current" />
                Run Analysis
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
