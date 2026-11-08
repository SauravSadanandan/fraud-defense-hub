import { useState } from "react";
import { ShieldAlert, UserX, Clock, LogOut, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

export interface NoAccessProps {
  variant: "pending" | "disabled" | "forbidden";
  message?: string;
}

export function NoAccess({ variant, message }: NoAccessProps) {
  const { firebaseUser, requestAccess, logout } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const handleRequestAccess = async () => {
    setSubmitting(true);
    setRequestError(null);
    const res = await requestAccess();
    setSubmitting(false);
    if (res.ok) {
      setRequested(true);
    } else {
      setRequestError(res.error || "Failed to submit request.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark showText={false} className="scale-125" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Access Restricted</h1>
            <p className="mt-1 text-sm text-muted-foreground">AppsFlyer Anti-Fraud Console</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-7 text-center shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)]">
          {variant === "pending" && (
            <div className="space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                <Clock className="size-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Account Pending Approval</h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-mono text-foreground">{firebaseUser?.email}</span>. Your
                  account does not currently have an active profile in this workspace.
                </p>
              </div>

              {requested ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>Access request submitted. An administrator will review your request.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Click below to notify the workspace administrators to grant you access.
                  </p>
                  <Button
                    onClick={handleRequestAccess}
                    disabled={submitting}
                    className="w-full"
                    size="default"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : "Request access"}
                  </Button>
                </div>
              )}

              {requestError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {requestError}
                </div>
              )}
            </div>
          )}

          {variant === "disabled" && (
            <div className="space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <UserX className="size-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Account Disabled</h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-mono text-foreground">{firebaseUser?.email}</span>. Your
                  account has been deactivated by an administrator. Please reach out to your team
                  lead.
                </p>
              </div>
            </div>
          )}

          {variant === "forbidden" && (
            <div className="space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert className="size-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Permission Denied</h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {message || "You do not have the required permissions to access this resource."}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => logout()} className="gap-2 text-xs">
              <LogOut className="size-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
