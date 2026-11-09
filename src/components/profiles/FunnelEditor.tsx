import { useState, useMemo } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, ListOrdered, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "./TagInput";
import type { FunnelStage } from "@/engine/config";

interface FunnelEditorProps {
  value: FunnelStage[];
  onChange: (stages: FunnelStage[]) => void;
  disabled?: boolean;
}

export function FunnelEditor({ value = [], onChange, disabled = false }: FunnelEditorProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newAliases, setNewAliases] = useState<string[]>([]);
  const [newOptional, setNewOptional] = useState(false);

  // Check for duplicate event names across stages (warning)
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    const dupes = new Set<string>();
    value.forEach((stage, idx) => {
      (stage.eventNames || []).forEach((name) => {
        const norm = name.trim().toLowerCase();
        if (norm) {
          if (seen.has(norm) && seen.get(norm) !== idx) {
            dupes.add(norm);
          } else {
            seen.set(norm, idx);
          }
        }
      });
    });
    return Array.from(dupes);
  }, [value]);

  const addStage = () => {
    const label = newLabel.trim();
    if (!label || newAliases.length === 0) return;
    onChange([...value, { label, eventNames: newAliases, optional: newOptional }]);
    setNewLabel("");
    setNewAliases([]);
    setNewOptional(false);
  };

  const removeStage = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const moveStage = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= value.length) return;
    const updated = [...value];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    onChange(updated);
  };

  const updateStage = (idx: number, patch: Partial<FunnelStage>) => {
    const updated = [...value];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium">Conversion Funnel Progression</h4>
        <p className="text-xs text-muted-foreground">
          Define the expected sequence of post-install events. Users reaching later stages without
          earlier non-optional stages are flagged for Missing Funnel Event.
        </p>
      </div>

      {duplicates.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-500">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Event alias <strong>{duplicates.join(", ")}</strong> is assigned to multiple stages. The
            earlier stage will take precedence during analysis.
          </span>
        </div>
      )}

      {!disabled && (
        <div className="rounded-lg border border-border bg-card/40 p-3 space-y-3">
          <span className="text-xs font-semibold text-foreground">Add Funnel Stage</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-stage-label" className="text-xs">
                Stage Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-stage-label"
                placeholder="e.g. Purchase, Login"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">
                Event Names / Aliases <span className="text-destructive">*</span>
              </Label>
              <div className="mt-1">
                <TagInput
                  value={newAliases}
                  onChange={setNewAliases}
                  placeholder="Type event name (e.g. af_purchase) and press Enter…"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Switch
                id="new-stage-optional"
                checked={newOptional}
                onCheckedChange={setNewOptional}
              />
              <Label htmlFor="new-stage-optional" className="text-xs cursor-pointer">
                Optional stage (skipping this stage does not flag fraud)
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStage}
              disabled={!newLabel.trim() || newAliases.length === 0}
              className="h-8 gap-1 text-xs"
            >
              <Plus className="size-3.5" /> Add Stage
            </Button>
          </div>
        </div>
      )}

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          <ListOrdered className="mx-auto mb-1.5 size-4 text-muted-foreground" />
          No conversion funnel defined. Event mode will skip missing funnel step validation.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((stage, idx) => (
            <div
              key={`${stage.label}-${idx}`}
              className="rounded-lg border border-border bg-card/60 p-3 text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-primary shrink-0">
                    {idx + 1}
                  </span>
                  <Input
                    value={stage.label}
                    onChange={(e) => updateStage(idx, { label: e.target.value })}
                    disabled={disabled}
                    placeholder="Stage Label"
                    className="h-7 text-xs font-medium w-48"
                  />
                  <div className="flex items-center gap-1.5 ml-2">
                    <Switch
                      id={`opt-stage-${idx}`}
                      checked={stage.optional}
                      onCheckedChange={(checked) => updateStage(idx, { optional: checked })}
                      disabled={disabled}
                    />
                    <Label
                      htmlFor={`opt-stage-${idx}`}
                      className="text-[11px] text-muted-foreground cursor-pointer"
                    >
                      Optional
                    </Label>
                  </div>
                </div>

                {!disabled && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => moveStage(idx, "up")}
                      className="h-7 w-7 p-0 text-muted-foreground"
                      aria-label="Move stage up"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={idx === value.length - 1}
                      onClick={() => moveStage(idx, "down")}
                      className="h-7 w-7 p-0 text-muted-foreground"
                      aria-label="Move stage down"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStage(idx)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove stage"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  Event Names / Aliases (at least 1 required)
                </Label>
                <TagInput
                  value={stage.eventNames}
                  onChange={(eventNames) => updateStage(idx, { eventNames })}
                  placeholder="Add event alias and press Enter…"
                  disabled={disabled}
                />
                {stage.eventNames.length === 0 && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Stage requires at least one event alias.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
