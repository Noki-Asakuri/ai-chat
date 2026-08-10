import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { getAuthErrorDiagnostic } from "@/lib/authkit/error-diagnostic-server-functions";

export const Route = createFileRoute("/auth/error")({
  loader: function () {
    return getAuthErrorDiagnostic();
  },
  component: AuthErrorPage,
});

function AuthErrorPage() {
  const diagnostic = Route.useLoaderData();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-3xl rounded-lg border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Sign-in failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The sign-in request could not be completed. Try again or return home.
        </p>

        <div className="mt-4 space-y-3 text-left text-sm">
          <div>
            <div className="text-muted-foreground">Error code</div>
            <pre className="mt-1 rounded-md border bg-background px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap">
              {diagnostic?.code ?? "No error code recorded."}
            </pre>
          </div>

          <div>
            <div className="text-muted-foreground">Message</div>
            <pre className="mt-1 rounded-md border bg-background px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap">
              {diagnostic?.message ?? "No error message recorded."}
            </pre>
          </div>

          <div>
            <div className="text-muted-foreground">Stack trace</div>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md border bg-background px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap">
              {diagnostic?.stack ?? "No stack trace recorded."}
            </pre>
            {diagnostic?.stackTruncated ? (
              <p className="mt-1 text-xs text-muted-foreground">Stack trace truncated to fit the diagnostic cookie.</p>
            ) : null}
          </div>
        </div>

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
