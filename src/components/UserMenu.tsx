import { Link } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export function UserMenu() {
  const { user, profile, isAdmin, can, logout } = useAuth();
  const initials = (user?.name || "A").slice(0, 2).toUpperCase();
  const canAccessSettings = isAdmin || can("profiles.view");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{user?.name}</span>
            <Badge
              variant={isAdmin ? "default" : "secondary"}
              className="shrink-0 text-[10px] font-normal capitalize"
            >
              {isAdmin ? "Admin" : profile?.role || "Analyst"}
            </Badge>
          </div>
          <div className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
            {user?.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canAccessSettings && (
          <DropdownMenuItem asChild>
            <Link to="/settings" className="flex cursor-pointer items-center">
              <Settings className="mr-2 size-4" /> Settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
