import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Login } from "./Login";
import { NoAccess } from "./NoAccess";
import type { PermissionKey } from "@/lib/permissions";

export interface AuthGateProps {
  children: ReactNode;
  permission?: PermissionKey;
}

export function AuthGate({ children, permission }: AuthGateProps) {
  const { status, can } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "signedOut") {
    return <Login />;
  }

  if (status === "noProfile") {
    return <NoAccess variant="pending" />;
  }

  if (status === "disabled") {
    return <NoAccess variant="disabled" />;
  }

  if (status === "ready") {
    if (permission && !can(permission)) {
      return (
        <NoAccess
          variant="forbidden"
          message={`You lack the required permission (${permission}) to view this page.`}
        />
      );
    }
    return <>{children}</>;
  }

  return null;
}
