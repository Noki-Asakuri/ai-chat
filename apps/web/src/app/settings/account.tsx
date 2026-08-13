import { createFileRoute } from "@tanstack/react-router";
import { toast } from "@/components/ui/toast";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/settings-section";
import { Separator } from "@/components/ui/separator";

import { AccountProfileCard } from "./-components/account/account-profile-card";
import { AccountSessionsCard } from "./-components/account/account-sessions-card";

export const Route = createFileRoute("/settings/account")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Account - AI Chat" }] }),
});

function RouteComponent() {
  return (
    <div className="flex flex-col gap-8">
      <AccountProfileCard />
      <Separator />
      <AccountSessionsCard />
      <Separator />
      <SettingsSection
        id="danger-zone"
        title="Danger zone"
        description="Permanently delete all of your data. This action cannot be undone."
      >
        <div className="flex justify-end py-1">
          <Button
            type="button"
            variant="destructive"
            onClick={() => toast.message("This feature is not available yet.")}
          >
            Request full data deletion
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
