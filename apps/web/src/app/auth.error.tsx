import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/error")({ component: AuthErrorPage });

function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Sign-in failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The sign-in request could not be completed. Try again or return home.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button nativeButton={false} render={<a href="/auth/login" />}>
            Try again
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
