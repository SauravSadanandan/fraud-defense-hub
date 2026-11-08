import { useState } from "react";
import { Plus, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "./TagInput";
import type { GeoRule } from "@/engine/config";

interface GeoRulesEditorProps {
  value: GeoRule[];
  onChange: (rules: GeoRule[]) => void;
  disabled?: boolean;
}

export function GeoRulesEditor({ value = [], onChange, disabled = false }: GeoRulesEditorProps) {
  const [newCountry, setNewCountry] = useState("");

  const addCountry = () => {
    const code = newCountry.trim().toUpperCase();
    if (code.length !== 2) return;
    if (value.some((g) => g.country === code)) return;
    onChange([...value, { country: code, knownCarriers: [] }]);
    setNewCountry("");
  };

  const removeCountry = (index: number) => {
    onChange(value.filter((_, idx) => idx !== index));
  };

  const updateCarriers = (index: number, knownCarriers: string[]) => {
    const updated = [...value];
    updated[index] = { ...updated[index], knownCarriers };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Target Geos &amp; Carriers</h4>
          <p className="text-xs text-muted-foreground">
            Only installs and events matching these country codes will be accepted. Leave empty for
            unrestricted global detection.
          </p>
        </div>
      </div>

      {!disabled && (
        <div className="flex items-end gap-2">
          <div className="w-32">
            <Label htmlFor="add-country-code" className="text-xs">
              Country Code
            </Label>
            <Input
              id="add-country-code"
              placeholder="e.g. IN, US"
              maxLength={2}
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCountry();
                }
              }}
              className="mt-1 h-8 text-xs uppercase"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCountry}
            disabled={newCountry.trim().length !== 2}
            className="h-8 gap-1 text-xs"
          >
            <Plus className="size-3.5" /> Add Country
          </Button>
        </div>
      )}

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          <Globe className="mx-auto mb-1.5 size-4 text-muted-foreground" />
          No geo restrictions (Global). Any country code and carrier will be considered valid.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((geo, idx) => (
            <div
              key={geo.country}
              className="rounded-lg border border-border bg-card/60 p-3 text-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground tracking-wide text-sm flex items-center gap-1.5">
                  <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-mono">
                    {geo.country}
                  </span>
                </span>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCountry(idx)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Allowed Domestic Carriers
                </Label>
                <TagInput
                  value={geo.knownCarriers}
                  onChange={(carriers) => updateCarriers(idx, carriers)}
                  placeholder="Type carrier name (e.g. Jio, Verizon) and press Enter…"
                  disabled={disabled}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {geo.knownCarriers.length === 0
                    ? "No carrier filter: all carriers in this country are allowed."
                    : `${geo.knownCarriers.length} carriers configured. Unmatched carriers will trigger a Carrier Mismatch signal.`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
