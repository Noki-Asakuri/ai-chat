import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/account")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Account - AI Chat" }] }),
});

function RouteComponent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Account settings coming soon.</p>
    </div>
  );
}
