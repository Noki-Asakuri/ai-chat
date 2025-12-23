import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error["message"] === "string") return error["message"];
  return null;
}

function getErrorStack(error: unknown): string | null {
  if (error instanceof Error && typeof error.stack === "string") return error.stack;
  if (isRecord(error) && typeof error["stack"] === "string") return error["stack"];
  return null;
}

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  const message = getErrorMessage(error);
  const stack = getErrorStack(error);

  console.error("DefaultCatchBoundary Error:", error);

  return (
    <main className="custom-scroll mx-auto flex min-h-svh w-full flex-1 items-center justify-center overflow-y-auto px-6 py-4">
      <div className="w-full max-w-3xl space-y-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-muted-foreground">
            We couldn't load this page. Try again, or go back and continue where you left off.
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Next steps</CardTitle>
            <CardDescription>These actions may help you recover.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-1 text-center text-sm text-muted-foreground">
            <p>• Try reloading this page’s data.</p>
            <p>• If the problem persists, go back and try again from where you came from.</p>
          </CardContent>

          <CardFooter className="justify-center gap-2">
            <Button
              onClick={async () => {
                await router.invalidate();
              }}
            >
              Try again
            </Button>

            {isRoot ? (
              <Button render={<Link to="/" />} variant="secondary">
                Go Home
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => window.history.back()}>
                Go back
              </Button>
            )}
          </CardFooter>
        </Card>

        <details className="group rounded-lg border bg-card px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground transition-colors group-open:text-foreground">
            Technical details
          </summary>

          <div className="mt-3 space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground">Message</div>
              <pre className="mt-1 rounded-md border bg-background px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap">
                {message ?? "No message provided."}
              </pre>
            </div>

            {import.meta.env.DEV && stack ? (
              <div>
                <div className="text-muted-foreground">Stack</div>
                <pre className="mt-1 max-h-64 overflow-auto rounded-md border bg-background px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap">
                  {stack}
                </pre>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </main>
  );
}
