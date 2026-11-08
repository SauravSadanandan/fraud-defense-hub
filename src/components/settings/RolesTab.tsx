import { useEffect, useState, useMemo } from "react";
import { ShieldCheck, Plus, Trash2, Save, Loader2, Info, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PERMISSION_CATALOG,
  DEFAULT_ROLES,
  type PermissionKey,
  type PermissionDefinition,
} from "@/lib/permissions";
import {
  subscribeRoles,
  subscribeUsers,
  seedDefaultRolesIfNeeded,
  saveRolePermissions,
  createCustomRole,
  deleteCustomRole,
  type RoleDoc,
  type UserProfile,
} from "@/lib/members";
import { useAuth } from "@/lib/auth";

export function RolesTab() {
  const { firebaseUser } = useAuth();
  const currentUid = firebaseUser?.uid || "";

  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local permissions draft state: roleId -> { [permKey]: boolean }
  const [draft, setDraft] = useState<Record<string, Record<PermissionKey, boolean>>>({});

  // Create role dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUid) {
      void seedDefaultRolesIfNeeded(currentUid);
    }
  }, [currentUid]);

  useEffect(() => {
    let rolesLoaded = false;
    let usersLoaded = false;

    const checkLoaded = () => {
      if (rolesLoaded && usersLoaded) {
        setLoading(false);
      }
    };

    const unsubRoles = subscribeRoles(
      (data) => {
        setRoles(data);
        // initialize draft
        setDraft((prev) => {
          const next = { ...prev };
          data.forEach((r) => {
            if (!next[r.id]) {
              next[r.id] = { ...(r.permissions as Record<PermissionKey, boolean>) };
            }
          });
          return next;
        });
        rolesLoaded = true;
        checkLoaded();
      },
      (err) => toast.error("Failed to load roles: " + err.message),
    );

    const unsubUsers = subscribeUsers(
      (data) => {
        setUsers(data);
        usersLoaded = true;
        checkLoaded();
      },
      (err) => toast.error("Failed to load users: " + err.message),
    );

    return () => {
      unsubRoles();
      unsubUsers();
    };
  }, []);

  // Group permissions by category
  const permissionGroups = useMemo(() => {
    const groups: Record<string, PermissionDefinition[]> = {
      Analyses: [],
      Publishers: [],
      "Campaign profiles": [],
      Administration: [],
    };
    PERMISSION_CATALOG.forEach((perm) => {
      if (!groups[perm.group]) groups[perm.group] = [];
      groups[perm.group].push(perm);
    });
    return groups;
  }, []);

  // Check which roles have unsaved dirty changes
  const dirtyRoleIds = useMemo(() => {
    const dirty: string[] = [];
    roles.forEach((r) => {
      const currentPerms = draft[r.id];
      if (!currentPerms) return;
      for (const p of PERMISSION_CATALOG) {
        if (p.adminOnly) continue;
        const origVal = !!r.permissions[p.key];
        const draftVal = !!currentPerms[p.key];
        if (origVal !== draftVal) {
          dirty.push(r.id);
          break;
        }
      }
    });
    return dirty;
  }, [roles, draft]);

  const handleTogglePermission = (roleId: string, permKey: PermissionKey, checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      [roleId]: {
        ...(prev[roleId] || {}),
        [permKey]: checked,
      },
    }));
  };

  const handleSaveChanges = async () => {
    if (dirtyRoleIds.length === 0) return;
    setSaving(true);
    try {
      for (const roleId of dirtyRoleIds) {
        const perms = draft[roleId] || {};
        await saveRolePermissions(roleId, perms, currentUid);
      }
      toast.success("Role permissions updated successfully.");
    } catch (e) {
      toast.error("Failed to save permissions", {
        description: e instanceof Error ? e.message : "Error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      await createCustomRole({
        name: roleName,
        roleId: roleSlug,
        description: roleDesc,
        actorUid: currentUid,
      });

      toast.success(`Role '${roleName}' created successfully.`);
      setRoleName("");
      setRoleSlug("");
      setRoleDesc("");
      setCreateOpen(false);
    } catch (err: unknown) {
      setCreateError((err as Error)?.message || "Failed to create role.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRole = async (roleId: string, name: string) => {
    try {
      await deleteCustomRole(roleId);
      toast.success(`Role '${name}' deleted.`);
    } catch (err: unknown) {
      toast.error("Failed to delete role", {
        description: (err as Error)?.message || "Error",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Roles &amp; Permissions</h2>
            <p className="text-xs text-muted-foreground">
              Define role permissions. Administrator permissions are all-inclusive and
              server-enforced.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="size-4" /> Create role
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateSubmit}>
                  <DialogHeader>
                    <DialogTitle>Create custom role</DialogTitle>
                    <DialogDescription>
                      Custom roles start with standard analyst permissions.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="role-name">Role Name</Label>
                      <Input
                        id="role-name"
                        value={roleName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRoleName(val);
                          // Auto-generate slug if not manually customized
                          setRoleSlug(
                            val
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-+|-+$/g, "")
                              .slice(0, 32),
                          );
                        }}
                        placeholder="e.g. Senior Auditor"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="role-slug">Role Identifier (Slug)</Label>
                      <Input
                        id="role-slug"
                        value={roleSlug}
                        onChange={(e) => setRoleSlug(e.target.value.toLowerCase())}
                        placeholder="e.g. senior-auditor"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        2-32 lowercase alphanumeric characters or hyphens.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="role-desc">Description</Label>
                      <Input
                        id="role-desc"
                        value={roleDesc}
                        onChange={(e) => setRoleDesc(e.target.value)}
                        placeholder="Brief summary of duties and access level"
                      />
                    </div>

                    {createError && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                        {createError}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCreateOpen(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? <Loader2 className="size-4 animate-spin" /> : "Create role"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              onClick={handleSaveChanges}
              disabled={dirtyRoleIds.length === 0 || saving}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save changes {dirtyRoleIds.length > 0 && `(${dirtyRoleIds.length})`}
            </Button>
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-4 font-medium text-muted-foreground min-w-[260px]">
                  Permission Area
                </th>
                {/* Admin column always first */}
                <th className="p-4 text-center min-w-[140px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-foreground">Admin</span>
                    <Badge variant="outline" className="text-[10px]">
                      System
                    </Badge>
                  </div>
                </th>
                {/* Non-admin roles */}
                {roles.map((r) => {
                  const memberCount = users.filter((u) => u.role === r.id).length;
                  const isSystem = r.system || r.id === "analyst";

                  return (
                    <th key={r.id} className="p-4 text-center min-w-[150px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold text-foreground">{r.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            {memberCount} member{memberCount !== 1 ? "s" : ""}
                          </span>
                          {!isSystem && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-5 text-muted-foreground hover:text-destructive"
                                  disabled={memberCount > 0}
                                  title={
                                    memberCount > 0
                                      ? "Reassign members before deleting"
                                      : "Delete role"
                                  }
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete role '{r.name}'?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. No members are currently assigned
                                    to this role.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteRole(r.id, r.name)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(permissionGroups).map(([groupName, perms]) => (
                <tr key={groupName} className="border-b border-border/60">
                  <td colSpan={roles.length + 2} className="p-0">
                    <div className="bg-muted/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {groupName}
                    </div>
                    <table className="w-full">
                      <tbody>
                        {perms.map((p) => {
                          const isExport = p.key === "analysis.export";

                          return (
                            <tr
                              key={p.key}
                              className="border-t border-border/40 hover:bg-muted/10 transition-colors"
                            >
                              <td className="p-4 min-w-[260px]">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5 font-medium">
                                    <span>{p.label}</span>
                                    {isExport && (
                                      <Badge variant="secondary" className="text-[9px] font-normal">
                                        Client UI
                                      </Badge>
                                    )}
                                    {p.adminOnly && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] font-normal text-amber-500 border-amber-500/30"
                                      >
                                        Admin Only
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {p.description}
                                  </span>
                                </div>
                              </td>

                              {/* Admin column */}
                              <td className="p-4 text-center min-w-[140px]">
                                <div className="flex justify-center">
                                  <Checkbox checked={true} disabled className="opacity-70" />
                                </div>
                              </td>

                              {/* Non-admin role columns */}
                              {roles.map((r) => {
                                const currentPerms = draft[r.id] || {};
                                const isChecked = !!currentPerms[p.key];
                                const isLocked = !!p.adminOnly;

                                return (
                                  <td key={r.id} className="p-4 text-center min-w-[150px]">
                                    <div className="flex justify-center">
                                      {isLocked ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="inline-flex items-center">
                                              <Lock className="size-3.5 text-muted-foreground/60" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Administration permissions are reserved for Admins only.
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={(c) =>
                                            handleTogglePermission(r.id, p.key, !!c)
                                          }
                                        />
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
