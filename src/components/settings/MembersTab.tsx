import { useEffect, useState, useMemo } from "react";
import {
  UserPlus,
  Mail,
  Trash2,
  RotateCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  subscribeUsers,
  subscribeRoles,
  subscribeAccessRequests,
  updateUserRole,
  updateUserStatus,
  deleteUserProfile,
  resendInviteEmail,
  inviteUser,
  approveAccessRequest,
  rejectAccessRequest,
  type UserProfile,
  type RoleDoc,
  type AccessRequestDoc,
} from "@/lib/members";
import { useAuth } from "@/lib/auth";

export function MembersTab() {
  const { firebaseUser } = useAuth();
  const currentUid = firebaseUser?.uid || "";

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [requests, setRequests] = useState<AccessRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("analyst");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Approval role state map: reqUid -> role
  const [approvalRoles, setApprovalRoles] = useState<Record<string, string>>({});

  useEffect(() => {
    let usersLoaded = false;
    let rolesLoaded = false;
    let reqsLoaded = false;

    const checkLoaded = () => {
      if (usersLoaded && rolesLoaded && reqsLoaded) {
        setLoading(false);
      }
    };

    const unsubUsers = subscribeUsers(
      (data) => {
        setUsers(data);
        usersLoaded = true;
        checkLoaded();
      },
      (err) => toast.error("Failed to load users: " + err.message),
    );

    const unsubRoles = subscribeRoles(
      (data) => {
        setRoles(data);
        rolesLoaded = true;
        checkLoaded();
      },
      (err) => toast.error("Failed to load roles: " + err.message),
    );

    const unsubReqs = subscribeAccessRequests(
      (data) => {
        setRequests(data);
        reqsLoaded = true;
        checkLoaded();
      },
      (err) => toast.error("Failed to load requests: " + err.message),
    );

    return () => {
      unsubUsers();
      unsubRoles();
      unsubReqs();
    };
  }, []);

  const activeAdminsCount = useMemo(() => {
    return users.filter((u) => u.role === "admin" && u.status === "active").length;
  }, [users]);

  // Available roles for selection (admin + all custom & system roles)
  const roleOptions = useMemo(() => {
    const opts = [{ id: "admin", name: "Admin" }];
    roles.forEach((r) => {
      if (r.id !== "admin") {
        opts.push({ id: r.id, name: r.name });
      }
    });
    return opts;
  }, [roles]);

  const handleRoleChange = async (targetUser: UserProfile, newRole: string) => {
    if (targetUser.uid === currentUid) return;
    try {
      await updateUserRole(targetUser.uid, newRole, currentUid);
      toast.success(`Role updated for ${targetUser.email}`);
    } catch (e) {
      toast.error("Failed to update role", {
        description: e instanceof Error ? e.message : "Error",
      });
    }
  };

  const handleStatusToggle = async (targetUser: UserProfile, checked: boolean) => {
    if (targetUser.uid === currentUid) return;
    const newStatus = checked ? "active" : "disabled";
    try {
      await updateUserStatus(targetUser.uid, newStatus, currentUid);
      toast.success(
        `${targetUser.email} is now ${newStatus === "active" ? "enabled" : "disabled"}`,
      );
    } catch (e) {
      toast.error("Failed to update status", {
        description: e instanceof Error ? e.message : "Error",
      });
    }
  };

  const handleDeleteUser = async (targetUid: string, email: string) => {
    if (targetUid === currentUid) return;
    try {
      await deleteUserProfile(targetUid);
      toast.success(`Removed member profile for ${email}`);
    } catch (e) {
      toast.error("Failed to remove member", {
        description: e instanceof Error ? e.message : "Error",
      });
    }
  };

  const handleResendInvite = async (email: string) => {
    try {
      await resendInviteEmail(email);
      toast.success(`Password reset / invitation email sent to ${email}`);
    } catch (e) {
      toast.error("Failed to send email", {
        description: e instanceof Error ? e.message : "Error",
      });
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);

    const res = await inviteUser({
      email: inviteEmail,
      displayName: inviteName,
      role: inviteRole,
      actorUid: currentUid,
    });

    setInviting(false);

    if (res.ok) {
      if (res.emailSent) {
        toast.success(`Invitation sent to ${inviteEmail}`);
      } else {
        toast.warning(
          `Member ${inviteEmail} was created, but sending the setup email failed. You can use 'Resend invite' anytime.`,
        );
      }
      setInviteEmail("");
      setInviteName("");
      setInviteRole("analyst");
      setInviteOpen(false);
    } else {
      setInviteError(res.error || "Failed to invite user.");
    }
  };

  const handleApproveRequest = async (req: AccessRequestDoc) => {
    const role = approvalRoles[req.uid] || "analyst";
    try {
      await approveAccessRequest(req, role, currentUid);
      toast.success(`Approved access for ${req.email} as ${role}`);
    } catch (e) {
      toast.error("Failed to approve access request", {
        description: e instanceof Error ? e.message : "Error",
      });
    }
  };

  const handleRejectRequest = async (uid: string, email: string) => {
    try {
      await rejectAccessRequest(uid);
      toast.success(`Rejected access request for ${email}`);
    } catch (e) {
      toast.error("Failed to reject access request", {
        description: e instanceof Error ? e.message : "Error",
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
      <div className="space-y-8">
        {/* Members Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Team Members</h2>
            <p className="text-xs text-muted-foreground">
              Manage member accounts, assign roles, and grant access to the anti-fraud hub.
            </p>
          </div>

          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 self-start sm:self-auto">
                <UserPlus className="size-4" /> Invite member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleInviteSubmit}>
                <DialogHeader>
                  <DialogTitle>Invite a new member</DialogTitle>
                  <DialogDescription>
                    Creates an account and sends a password setup email.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="analyst@company.com"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="invite-name">Display name (optional)</Label>
                    <Input
                      id="invite-name"
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role">Assign Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger id="invite-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {inviteError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                      {inviteError}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setInviteOpen(false)}
                    disabled={inviting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? <Loader2 className="size-4 animate-spin" /> : "Send invitation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Members Table */}
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.uid === currentUid;
                const isLastAdmin =
                  u.role === "admin" && u.status === "active" && activeAdminsCount <= 1;
                const createdDate = u.createdAt?.toDate
                  ? u.createdAt.toDate().toLocaleDateString()
                  : "—";

                return (
                  <TableRow key={u.uid}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span>{u.displayName || u.email.split("@")[0]}</span>
                          {isSelf && (
                            <Badge variant="outline" className="text-[10px]">
                              You
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {isSelf || isLastAdmin ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Select
                                value={u.role}
                                onValueChange={(val) => handleRoleChange(u, val)}
                                disabled
                              >
                                <SelectTrigger className="w-[130px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleOptions.map((opt) => (
                                    <SelectItem key={opt.id} value={opt.id}>
                                      {opt.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isSelf
                              ? "You cannot change your own role."
                              : "Cannot demote the last active administrator."}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Select value={u.role} onValueChange={(val) => handleRoleChange(u, val)}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    <TableCell>
                      {isSelf || isLastAdmin ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center gap-2">
                              <Switch checked={u.status === "active"} disabled />
                              <span className="text-xs capitalize text-muted-foreground">
                                {u.status}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isSelf
                              ? "You cannot disable your own account."
                              : "Cannot disable the last active administrator."}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={u.status === "active"}
                            onCheckedChange={(c) => handleStatusToggle(u, c)}
                          />
                          <span className="text-xs capitalize text-muted-foreground">
                            {u.status}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">{createdDate}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              onClick={() => handleResendInvite(u.email)}
                            >
                              <RotateCw className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Resend invite / password reset email</TooltipContent>
                        </Tooltip>

                        {isSelf || isLastAdmin ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground opacity-50 cursor-not-allowed"
                                  disabled
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isSelf
                                ? "You cannot remove your own account."
                                : "Cannot remove the last active administrator."}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will revoke access for{" "}
                                  <span className="font-semibold">{u.email}</span>. Their saved data
                                  will remain intact.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(u.uid, u.email)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pending Access Requests Panel */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-amber-500" />
            <h3 className="text-sm font-semibold tracking-tight">Pending Access Requests</h3>
            {requests.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {requests.length}
              </Badge>
            )}
          </div>

          {requests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No pending access requests at this time.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Email Status</TableHead>
                    <TableHead>Requested Time</TableHead>
                    <TableHead>Role to Assign</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const reqDate = req.requestedAt?.toDate
                      ? req.requestedAt.toDate().toLocaleString()
                      : "Recently";
                    const selectedRole = approvalRoles[req.uid] || "analyst";

                    return (
                      <TableRow key={req.uid}>
                        <TableCell>
                          <div className="font-medium text-sm">{req.displayName}</div>
                          <div className="text-xs text-muted-foreground">{req.email}</div>
                        </TableCell>
                        <TableCell>
                          {req.emailVerified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600/30">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-amber-500">
                              Unverified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{reqDate}</TableCell>
                        <TableCell>
                          <Select
                            value={selectedRole}
                            onValueChange={(val) =>
                              setApprovalRoles((prev) => ({ ...prev, [req.uid]: val }))
                            }
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => handleRejectRequest(req.uid, req.email)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleApproveRequest(req)}
                            >
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
