import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import type { PermissionKey } from "@/lib/permissions";

export interface CanProps {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useAuth();
  if (can(permission)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
