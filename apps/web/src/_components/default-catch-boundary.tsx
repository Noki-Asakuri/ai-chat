import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, ChevronRightIcon, HouseIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { useChatStore } from "@/lib/store/chat-store";

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const { hasChatComposer, isRoot } = useMatch({
    strict: false,
    select: (state) => ({
      hasChatComposer: state.id.startsWith("/_chat/"),
      isRoot: state.id === rootRouteId,
    }),
  });
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const normalizedError = normalizeError(error);
  const message = normalizedError.message;
  const stack = normalizedError.stack ?? null;

  console.error("DefaultCatchBoundary Error:", error);

  return (
    <main
      className="mx-auto flex h-dvh w-full items-center justify-center overflow-hidden px-4 sm:px-6"
      style={{
        paddingTop: hasChatComposer ? 64 : 16,
        paddingBottom: hasChatComposer ? textareaHeight : 16,
      }}
    >
      <Card className="max-h-full min-h-0 w-full max-w-3xl gap-0 py-0" role="alert">
        <CardHeader className="shrink-0 border-b py-4 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <TriangleAlertIcon aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <CardTitle>
                <h1>Something went wrong</h1>
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                We couldn't load this page. Retry the request or return to the previous screen.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 overflow-y-auto py-4 sm:py-5">
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-medium text-muted-foreground">Error message</h2>
            <pre className="overflow-x-auto rounded-md bg-background p-3 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap ring-1 ring-foreground/10">
              {message || "No message provided."}
            </pre>
          </div>

          {import.meta.env.DEV && stack ? (
            <details className="group mt-4 border-t pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none">
                <ChevronRightIcon className="transition-transform group-open:rotate-90" aria-hidden="true" />
                Developer stack trace
              </summary>

              <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap ring-1 ring-foreground/10">
                {stack}
              </pre>
            </details>
          ) : null}
        </CardContent>

        <CardFooter className="shrink-0 flex-col gap-2 bg-card py-3 sm:flex-row sm:justify-end">
          <Button
            className="w-full sm:w-auto"
            onClick={async () => {
              await router.invalidate();
            }}
          >
            <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>

          {isRoot ? (
            <Button
              nativeButton={false}
              render={<Link to="/" />}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <HouseIcon data-icon="inline-start" aria-hidden="true" />
              Go home
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => window.history.back()}>
              <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
              Go back
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
