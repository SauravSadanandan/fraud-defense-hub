import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FunnelStage } from "@/engine/config";

interface FunnelEditorProps {
  value: FunnelStage[];
  onChange: (stages: FunnelStage[]) => void;
  disabled?: boolean;
}

export function FunnelEditor({ value = [], onChange, disabled = false }: FunnelEditorProps) {
  const [newEventName, setNewEventName] = useState("");
  const [newStageLabel, setNewStageLabel] = useState("");

  const addStage = () => {
    const name = newEventName.trim();
    if (!name) return;
    const label = newStageLabel.trim() || undefined;
    const nextOrder = value.length;
    onChange([...value, { name, label, order: nextOrder }]);
    setNewEventName("");
    setNewStageLabel("");
  };

  const removeStage = (idx: number) => {
    const updated = value.filter((_, i) => i !== idx).map((stage, i) => ({ ...stage, order: i }));
    onChange(updated);
  };

  const moveStage = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= value.length) return;
    const updated = [...value];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    onChange(updated.map((stage, i) => ({ ...stage, order: i })));
  };

  const updateStageField = (idx: number, field: "name" | "label", val: string) => {
    const updated = [...value];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium">Conversion Funnel Progression</h4>
        <p className="text-xs text-muted-foreground">
          Define expected sequence of post-install events. Users reaching later stages without
          earlier events are flagged for Missing Funnel Event.
        </p>
      </div>

      {!disabled && (
        <div className="flex flex-col sm:flex-row items-end gap-2">
          <div className="flex-1 w-full">
            <Label htmlFor="add-funnel-name" className="text-xs">
              Event Name
            </Label>
            <Input
              id="add-funnel-name"
              placeholder="e.g. af_purchase"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div className="flex-1 w-full">
            <Label htmlFor="add-funnel-label" className="text-xs">
              Display Label (optional)
            </Label>
            <Input
              id="add-funnel-label"
              placeholder="e.g. Purchase"
              value={newStageLabel}
              onChange={(e) => setNewStageLabel(e.target.value)}
              className="mt-1 h-8 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStage}
            disabled={!newEventName.trim()}
            className="h-8 gap-1 text-xs shrink-0"
          >
            <Plus className="size-3.5" /> Add Stage
          </Button>
        </div>
      )}

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          <ListOrdered className="mx-auto mb-1.5 size-4 text-muted-foreground" />
          No conversion funnel defined. Event mode will skip missing funnel step validation.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((stage, idx) => (
            <div
              key={`${stage.name}-${idx}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-card/60 p-2 text-xs"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-primary shrink-0">
                {idx + 1}
              </span>
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={stage.name}
                  onChange={(e) => updateStageField(idx, "name", e.target.value)}
                  disabled={disabled}
                  placeholder="Event name"
                  className="h-7 text-xs font-mono"
                />
                <Input
                  value={stage.label || ""}
                  onChange={(e) => updateStageField(idx, "label", e.target.value)}
                  disabled={disabled}
                  placeholder="Label (optional)"
                  className="h-7 text-xs"
                />
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
          ))}
        </div>
      )}
    </div>
  );
}
