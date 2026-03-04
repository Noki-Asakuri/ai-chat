import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { AccountProfileCard } from "./-components/account/account-profile-card";
import { AccountSessionsCard } from "./-components/account/account-sessions-card";

export const Route = createFileRoute("/settings/account")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Account - AI Chat" }] }),
});

function RouteComponent() {
  return (
    <div className="space-y-6">
      <AccountProfileCard />
      <AccountSessionsCard />
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Permanently delete all of your data. This action cannot be undone.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={() => toast.message("This feature is not available yet.")}
          >
            Request full data deletion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
