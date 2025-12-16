import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="rounded-md">
        <CardHeader className="border-b">
          <div>
            <CardTitle>Model picker</CardTitle>
            <CardDescription>
              Control which models show up in the chat model selector.
            </CardDescription>
          </div>

          <CardAction>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Search models</Label>
              <Input disabled className="bg-input/30" />
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Label className="text-sm leading-none font-medium">Visible only</Label>
                <p className="text-sm text-muted-foreground">
                  Hide already-hidden models from the list.
                </p>
              </div>

              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <Skeleton className="h-4 w-20" />
            </Badge>
            <Badge variant="secondary">
              <Skeleton className="h-4 w-20" />
            </Badge>
            <Skeleton className="h-4 w-56" />
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="rounded-md">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-5 rounded-sm" />
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
