import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function LoadingCustomizationSkeleton() {
  return (
    <div className="space-y-6">
      <form className="space-y-6">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>Basic information used to personalize responses.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="w-full space-y-2">
              <Label>What should AI call you?</Label>
              <Input disabled className="bg-input/30" placeholder="Enter your name" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>System instruction</CardTitle>
            <CardDescription>
              A global instruction applied to the assistant across the app.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            <Label>Instruction</Label>
            <Textarea disabled className="min-h-[150px] bg-input/30" />
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-start">
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>Behavior options</CardTitle>
              <CardDescription>Toggle how the interface behaves for you.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-0">
              <div className="flex items-start justify-between gap-6 py-4">
                <div className="min-w-0 space-y-1">
                  <Label className="text-sm leading-none font-medium">How to send messages</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose the keyboard shortcut used to send a message.
                  </p>
                </div>
                <Skeleton className="h-8 w-56 rounded-none" />
              </div>

              <Separator className="-mx-4" />

              <div className="flex items-start justify-between gap-6 py-4">
                <div className="min-w-0 space-y-1">
                  <Label className="text-sm leading-none font-medium">Wrap long code lines</Label>
                  <p className="text-sm text-muted-foreground">
                    Wrap code blocks instead of scrolling horizontally.
                  </p>
                </div>
                <Skeleton className="h-[1.15rem] w-8 rounded-full" />
              </div>

              <Separator className="-mx-4" />

              <div className="flex items-start justify-between gap-6 py-4">
                <div className="min-w-0 space-y-1">
                  <Label className="text-sm leading-none font-medium">Performance mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn on the performance mode (can improve readability).
                  </p>
                </div>
                <Skeleton className="h-[1.15rem] w-8 rounded-full" />
              </div>

              <Separator className="-mx-4" />

              <div className="flex items-start justify-between gap-6 py-4">
                <div className="min-w-0 space-y-1">
                  <Label className="text-sm leading-none font-medium">
                    Show full code by default
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Expand code blocks by default instead of clamping them.
                  </p>
                </div>
                <Skeleton className="h-[1.15rem] w-8 rounded-full" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>Background</CardTitle>
              <CardDescription>Optional background image used in the chat layout.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <Label className="text-sm leading-none font-medium">Background image</Label>
                  <p className="text-sm text-muted-foreground">
                    Upload an image to use as your chat background.
                  </p>
                  <p className="text-xs text-muted-foreground">Loading current background…</p>
                </div>

                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-24 rounded-md" />
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              </div>

              <div className="overflow-hidden rounded-md border bg-muted">
                <Skeleton className="aspect-video w-full" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-end">
          <Skeleton className="h-5 w-56 rounded-md" />
        </div>
      </form>
    </div>
  );
}
