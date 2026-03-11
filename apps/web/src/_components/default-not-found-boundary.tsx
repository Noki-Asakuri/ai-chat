import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DefaultNotFoundBoundary() {
  return (
    <main className="custom-scroll mx-auto flex min-h-svh w-full flex-1 items-center justify-center overflow-y-auto px-6 py-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-2xl font-bold">Page not found</h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Next steps</CardTitle>
            <CardDescription>Pick one of the options below to continue.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-1 text-center text-sm text-muted-foreground">
            <p>• Go back to the previous page if you followed a link.</p>
            <p>• Go home to start from the main screen.</p>
          </CardContent>

          <CardFooter className="justify-center gap-2">
            <Button variant="secondary" onClick={() => window.history.back()}>
              Go back
            </Button>

            <Button nativeButton={false} render={<Link to="/" />}>
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
