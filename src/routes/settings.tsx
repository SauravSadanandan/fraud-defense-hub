import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Users, Shield, Sliders } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { AuthGate } from "@/components/AuthGate";
import { NoAccess } from "@/components/NoAccess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersTab } from "@/components/settings/MembersTab";
import { RolesTab } from "@/components/settings/RolesTab";
import { ProfilesTab } from "@/components/profiles/ProfilesTab";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => {
    const isStaging = import.meta.env.VITE_APP_ENV === "staging";
    const title = isStaging ? "[STAGING] Settings · Opscore Argus" : "Settings · Opscore Argus";
    return {
      meta: [
        { title },
        { name: "description", content: "Team members, roles and access control settings." },
      ],
    };
  },
  component: SettingsPage,
});

function SettingsContent() {
  const { isAdmin, can } = useAuth();
  const canViewProfiles = can("profiles.view");

  const defaultTab = isAdmin ? "members" : canViewProfiles ? "campaign-profiles" : "members";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5" aria-label="Home">
              <BrandMark />
            </Link>
            <div className="h-4 w-px bg-border" />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back to console
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Console Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage organization team access, role permissions, and platform configurations.
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="h-10">
            {isAdmin && (
              <>
                <TabsTrigger value="members" className="gap-1.5">
                  <Users className="size-4" /> Members
                </TabsTrigger>
                <TabsTrigger value="roles" className="gap-1.5">
                  <Shield className="size-4" /> Roles &amp; permissions
                </TabsTrigger>
              </>
            )}
            {canViewProfiles && (
              <TabsTrigger value="campaign-profiles" className="gap-1.5">
                <Sliders className="size-4" /> Campaign profiles
              </TabsTrigger>
            )}
          </TabsList>

          {isAdmin ? (
            <>
              <TabsContent value="members" className="focus-visible:outline-none">
                <MembersTab />
              </TabsContent>
              <TabsContent value="roles" className="focus-visible:outline-none">
                <RolesTab />
              </TabsContent>
            </>
          ) : (
            <>
              <TabsContent value="members">
                <div className="rounded-xl border border-border p-8 text-center">
                  <NoAccess
                    variant="forbidden"
                    message="Administration tabs are accessible to administrators only."
                  />
                </div>
              </TabsContent>
              <TabsContent value="roles">
                <div className="rounded-xl border border-border p-8 text-center">
                  <NoAccess
                    variant="forbidden"
                    message="Administration tabs are accessible to administrators only."
                  />
                </div>
              </TabsContent>
            </>
          )}

          {canViewProfiles && (
            <TabsContent value="campaign-profiles" className="focus-visible:outline-none">
              <ProfilesTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function SettingsPage() {
  return (
    <AuthGate>
      <SettingsContent />
    </AuthGate>
  );
}
