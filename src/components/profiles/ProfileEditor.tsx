import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeoRulesEditor } from "./GeoRulesEditor";
import { FunnelEditor } from "./FunnelEditor";
import { ThresholdsFields } from "./ThresholdsFields";
import { profileFormSchema, type ProfileFormValues } from "@/lib/profileSchema";
import type { CampaignProfile } from "@/lib/profiles";
import { DEFAULT_SETTINGS } from "@/engine/config";

interface ProfileEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: CampaignProfile | null;
  onSave: (data: {
    name: string;
    description?: string;
    settings: CampaignProfile["settings"];
  }) => Promise<void>;
  saving?: boolean;
}

export function ProfileEditor({
  open,
  onOpenChange,
  profile,
  onSave,
  saving = false,
}: ProfileEditorProps) {
  const isEditing = Boolean(profile && !profile.isBuiltin);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      description: "",
      timezoneLabel: "IST",
      geos: DEFAULT_SETTINGS.geos,
      funnelStages: DEFAULT_SETTINGS.funnelStages,
      thresholds: DEFAULT_SETTINGS.thresholds,
      buildFlaggedInstalls: true,
      buildFlaggedEvents: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (profile) {
        reset({
          name: profile.isBuiltin ? `${profile.name} (Custom)` : profile.name,
          description: profile.description || "",
          timezoneLabel: profile.settings.timezoneLabel || "IST",
          geos: profile.settings.geos || [],
          funnelStages: profile.settings.funnelStages || [],
          thresholds: profile.settings.thresholds,
          buildFlaggedInstalls: profile.settings.buildFlaggedInstalls ?? true,
          buildFlaggedEvents: profile.settings.buildFlaggedEvents ?? true,
        });
      } else {
        reset({
          name: "",
          description: "",
          timezoneLabel: "IST",
          geos: DEFAULT_SETTINGS.geos,
          funnelStages: DEFAULT_SETTINGS.funnelStages,
          thresholds: DEFAULT_SETTINGS.thresholds,
          buildFlaggedInstalls: true,
          buildFlaggedEvents: true,
        });
      }
    }
  }, [open, profile, reset]);

  const onSubmit = async (values: ProfileFormValues) => {
    await onSave({
      name: values.name,
      description: values.description,
      settings: {
        schemaVersion: 2,
        geos: values.geos,
        funnelStages: values.funnelStages,
        timezoneLabel: values.timezoneLabel,
        thresholds: values.thresholds,
        buildFlaggedInstalls: values.buildFlaggedInstalls,
        buildFlaggedEvents: values.buildFlaggedEvents,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Campaign Profile" : "Create Campaign Profile"}
          </DialogTitle>
          <DialogDescription>
            Configure geographic filters, carriers, conversion funnel stages, and detection
            thresholds.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* General Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="profile-name" className="text-xs">
                Profile Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="profile-name"
                {...register("name")}
                placeholder="e.g. SEA Gaming Campaign"
                className="h-8 text-xs"
              />
              {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-tz" className="text-xs">
                Timezone Label
              </Label>
              <Input
                id="profile-tz"
                {...register("timezoneLabel")}
                placeholder="e.g. IST, UTC, SGT"
                className="h-8 text-xs"
              />
              {errors.timezoneLabel && (
                <p className="text-[11px] text-destructive">{errors.timezoneLabel.message}</p>
              )}
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label htmlFor="profile-desc" className="text-xs">
                Description (optional)
              </Label>
              <Input
                id="profile-desc"
                {...register("description")}
                placeholder="Brief summary of target region, partner requirements, etc."
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Config Tabs */}
          <Tabs defaultValue="geos" className="w-full">
            <TabsList className="grid grid-cols-3 h-9">
              <TabsTrigger value="geos" className="text-xs">
                Geos &amp; Carriers
              </TabsTrigger>
              <TabsTrigger value="funnel" className="text-xs">
                Conversion Funnel
              </TabsTrigger>
              <TabsTrigger value="thresholds" className="text-xs">
                Detection Thresholds
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geos" className="mt-4 focus-visible:outline-none">
              <Controller
                control={control}
                name="geos"
                render={({ field }) => (
                  <GeoRulesEditor value={field.value} onChange={field.onChange} />
                )}
              />
            </TabsContent>

            <TabsContent value="funnel" className="mt-4 focus-visible:outline-none">
              <Controller
                control={control}
                name="funnelStages"
                render={({ field }) => (
                  <FunnelEditor value={field.value} onChange={field.onChange} />
                )}
              />
            </TabsContent>

            <TabsContent value="thresholds" className="mt-4 focus-visible:outline-none">
              <Controller
                control={control}
                name="thresholds"
                render={({ field }) => (
                  <ThresholdsFields value={field.value} onChange={field.onChange} />
                )}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
