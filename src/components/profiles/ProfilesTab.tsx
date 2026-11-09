import { useEffect, useState } from "react";
import { Sliders, Plus, Copy, Pencil, Trash2, Lock, Globe, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProfileEditor } from "./ProfileEditor";
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  type CampaignProfile,
} from "@/lib/profiles";
import { useAuth } from "@/lib/auth";

export function ProfilesTab() {
  const { can } = useAuth();
  const canManage = can("profiles.manage");

  const [profiles, setProfiles] = useState<CampaignProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CampaignProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const list = await listProfiles();
      setProfiles(list);
    } catch (err) {
      toast.error("Failed to load campaign profiles", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfiles();
  }, []);

  const handleCreateNew = () => {
    setEditingProfile(null);
    setEditorOpen(true);
  };

  const handleEdit = (profile: CampaignProfile) => {
    setEditingProfile(profile);
    setEditorOpen(true);
  };

  const handleDuplicate = (profile: CampaignProfile) => {
    const copy: CampaignProfile = {
      ...profile,
      id: "",
      name: `${profile.name} (Copy)`,
      isBuiltin: false,
    };
    setEditingProfile(copy);
    setEditorOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    description?: string;
    appNames?: string[];
    settings: CampaignProfile["settings"];
  }) => {
    setSaving(true);
    try {
      if (editingProfile && !editingProfile.isBuiltin && editingProfile.id) {
        await updateProfile(editingProfile.id, data);
        toast.success("Profile updated");
      } else {
        await createProfile(data);
        toast.success("Profile created");
      }
      setEditorOpen(false);
      await fetchProfiles();
    } catch (err) {
      toast.error("Could not save profile", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProfile(id);
      toast.success("Profile deleted");
      await fetchProfiles();
    } catch (err) {
      toast.error("Could not delete profile", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Campaign Profiles</h2>
          <p className="text-xs text-muted-foreground">
            Configure geographic restrictions, carrier baselines, conversion funnels, and fraud
            thresholds per campaign.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchProfiles}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={handleCreateNew}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="size-3.5" /> New Profile
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">Profile</TableHead>
              <TableHead>Target Geos</TableHead>
              <TableHead>Funnel Stages</TableHead>
              <TableHead>CTIT Thresholds</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead className="text-right w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 size-5 animate-spin text-primary" />
                  Loading profiles…
                </TableCell>
              </TableRow>
            ) : profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  No campaign profiles found.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((p) => {
                const geos = p.settings.geos || [];
                const stages = p.settings.funnelStages || [];
                const thresh = p.settings.thresholds;

                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span>{p.name}</span>
                          {p.isBuiltin && (
                            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                              <Lock className="size-2.5" /> Built-in
                            </Badge>
                          )}
                        </div>
                        {p.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {p.description}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {geos.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="size-3" /> Global (Any)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {geos.map((g) => (
                            <Badge
                              key={g.country}
                              variant="secondary"
                              className="text-[11px] px-1.5 py-0"
                            >
                              {g.country}
                              {g.knownCarriers.length > 0 && ` (${g.knownCarriers.length})`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {stages.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {stages.length} stage{stages.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        &lt;{thresh.ctitClickInjectSec}s / &gt;{thresh.ctitClickFloodDays}d
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {p.settings.timezoneLabel || "UTC"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(p)}
                            title="Duplicate profile"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        )}

                        {canManage && !p.isBuiltin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(p)}
                            title="Edit profile"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}

                        {canManage && !p.isBuiltin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={deletingId === p.id}
                                title="Delete profile"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Campaign Profile</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete profile &ldquo;{p.name}&rdquo;?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(p.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={editingProfile}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
