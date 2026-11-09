import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "./TagInput";
import type { Thresholds } from "@/engine/config";

interface ThresholdsFieldsProps {
  value: Thresholds;
  onChange: (t: Thresholds) => void;
  flagZeroedGaid?: boolean;
  onChangeFlagZeroedGaid?: (val: boolean) => void;
  emulatorKeywords?: string[];
  onChangeEmulatorKeywords?: (keywords: string[]) => void;
  disabled?: boolean;
}

export function ThresholdsFields({
  value,
  onChange,
  flagZeroedGaid = true,
  onChangeFlagZeroedGaid,
  emulatorKeywords = ["unknown", "generic", "emulator", "sdk"],
  onChangeEmulatorKeywords,
  disabled = false,
}: ThresholdsFieldsProps) {
  const updateNum = (field: keyof Omit<Thresholds, "outdatedOsMaxMajor">, val: string) => {
    const parsed = parseInt(val, 10);
    onChange({
      ...value,
      [field]: isNaN(parsed) || parsed < 1 ? 1 : parsed,
    });
  };

  const updateOsNumber = (platform: "android" | "ios", val: string) => {
    const parsed = parseInt(val, 10);
    onChange({
      ...value,
      outdatedOsMaxMajor: {
        ...value.outdatedOsMaxMajor,
        [platform]: isNaN(parsed) || parsed < 1 ? 1 : parsed,
      },
    });
  };

  const toggleOsEnabled = (platform: "android" | "ios", enabled: boolean) => {
    onChange({
      ...value,
      outdatedOsMaxMajor: {
        ...value.outdatedOsMaxMajor,
        [platform]: enabled ? 9 : null,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium">Detection Thresholds &amp; Baselines</h4>
        <p className="text-xs text-muted-foreground">
          Calibrate sensitivity for CTIT, farms, device clusters, and timing uniformity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CTIT */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Click-To-Install Time (CTIT)
          </h5>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Click Injection (&lt; seconds)</Label>
              <Input
                type="number"
                min={1}
                value={value.ctitClickInjectSec}
                onChange={(e) => updateNum("ctitClickInjectSec", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">Default: 10s</span>
            </div>
            <div>
              <Label className="text-xs">Click Flooding (&gt; days)</Label>
              <Input
                type="number"
                min={1}
                value={value.ctitClickFloodDays}
                onChange={(e) => updateNum("ctitClickFloodDays", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">Default: 1 day</span>
            </div>
          </div>
        </div>

        {/* IP & Farms */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            IP &amp; Carrier Concentrations
          </h5>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">IP Farm Threshold</Label>
              <Input
                type="number"
                min={1}
                value={value.ipFarmThreshold}
                onChange={(e) => updateNum("ipFarmThreshold", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">
                &ge; occurrences (Default: 10)
              </span>
            </div>
            <div>
              <Label className="text-xs">Carrier IP Threshold</Label>
              <Input
                type="number"
                min={1}
                value={value.carrierIpThreshold}
                onChange={(e) => updateNum("carrierIpThreshold", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">
                &ge; occurrences (Default: 10)
              </span>
            </div>
          </div>
        </div>

        {/* Device & OS */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Device &amp; Operating System
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Device Cluster</Label>
              <Input
                type="number"
                min={1}
                value={value.deviceModelClusterThreshold}
                onChange={(e) => updateNum("deviceModelClusterThreshold", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">&ge; model count (10)</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Android OS</Label>
                <div className="flex items-center gap-1">
                  <Switch
                    id="toggle-android-os"
                    checked={value.outdatedOsMaxMajor.android !== null}
                    onCheckedChange={(c) => toggleOsEnabled("android", c)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor="toggle-android-os"
                    className="text-[10px] text-muted-foreground cursor-pointer"
                  >
                    {value.outdatedOsMaxMajor.android === null ? "Off" : "On"}
                  </Label>
                </div>
              </div>
              <Input
                type="number"
                min={1}
                disabled={disabled || value.outdatedOsMaxMajor.android === null}
                value={value.outdatedOsMaxMajor.android ?? ""}
                onChange={(e) => updateOsNumber("android", e.target.value)}
                placeholder="Disabled"
                className="h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">&le; major (Default: 9)</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">iOS</Label>
                <div className="flex items-center gap-1">
                  <Switch
                    id="toggle-ios-os"
                    checked={value.outdatedOsMaxMajor.ios !== null}
                    onCheckedChange={(c) => toggleOsEnabled("ios", c)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor="toggle-ios-os"
                    className="text-[10px] text-muted-foreground cursor-pointer"
                  >
                    {value.outdatedOsMaxMajor.ios === null ? "Off" : "On"}
                  </Label>
                </div>
              </div>
              <Input
                type="number"
                min={1}
                disabled={disabled || value.outdatedOsMaxMajor.ios === null}
                value={value.outdatedOsMaxMajor.ios ?? ""}
                onChange={(e) => updateOsNumber("ios", e.target.value)}
                placeholder="Disabled"
                className="h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">&le; major (Default: 9)</span>
            </div>
          </div>
        </div>

        {/* Statistical & Timing */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Timing &amp; Version Anomaly
          </h5>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Time of Day Cluster %</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={value.timeOfDayThresholdPct}
                onChange={(e) => updateNum("timeOfDayThresholdPct", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">
                &ge; % of source (Default: 15%)
              </span>
            </div>
            <div>
              <Label className="text-xs">Time of Day Min Sample</Label>
              <Input
                type="number"
                min={1}
                value={value.timeOfDayMinSample}
                onChange={(e) => updateNum("timeOfDayMinSample", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">Min source rows (20)</span>
            </div>
            <div>
              <Label className="text-xs">Uniform Timing Count</Label>
              <Input
                type="number"
                min={1}
                value={value.uniformTimingMinCount}
                onChange={(e) => updateNum("uniformTimingMinCount", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">&ge; events in bucket (5)</span>
            </div>
            <div>
              <Label className="text-xs">Uniform Timing Bucket</Label>
              <Input
                type="number"
                min={1}
                value={value.uniformTimingBucketSeconds}
                onChange={(e) => updateNum("uniformTimingBucketSeconds", e.target.value)}
                disabled={disabled}
                className="mt-1 h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">Bucket seconds (5s)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detection Options */}
      {(onChangeFlagZeroedGaid || onChangeEmulatorKeywords) && (
        <div className="rounded-lg border border-border p-3 space-y-4">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Detection Options
          </h5>

          {onChangeFlagZeroedGaid && (
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="flag-zero-gaid" className="text-xs font-medium cursor-pointer">
                  Flag Zeroed Advertising IDs (GAID)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Flag rows containing null device UUIDs (00000000-0000-0000-0000-000000000000) as
                  device farm spoofing.
                </p>
              </div>
              <Switch
                id="flag-zero-gaid"
                checked={flagZeroedGaid}
                onCheckedChange={onChangeFlagZeroedGaid}
                disabled={disabled}
              />
            </div>
          )}

          {onChangeEmulatorKeywords && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Emulator Model Keywords</Label>
              <p className="text-[11px] text-muted-foreground">
                Device models matching any of these substrings will trigger Unknown Device Model
                (Emulator).
              </p>
              <TagInput
                value={emulatorKeywords}
                onChange={onChangeEmulatorKeywords}
                placeholder="Type keyword and press Enter…"
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
