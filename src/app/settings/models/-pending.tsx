import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="rounded-md">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 border-b pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              >
                <Skeleton className="h-4 w-18" />
              </Badge>
              <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-300">
                <Skeleton className="h-4 w-18" />
              </Badge>
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-300"
              >
                <Skeleton className="h-4 w-18" />
              </Badge>
              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                <Skeleton className="h-4 w-20" />
              </Badge>

              <Skeleton className="ml-auto h-3 w-50" />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-32 rounded-md" />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)_minmax(13rem,16rem)_minmax(13rem,16rem)] lg:items-start">
            <div className="space-y-2">
              <Label>Search models</Label>
              <Input disabled className="bg-input/30" />
            </div>

            <div className="space-y-2">
              <Label>Capability</Label>
              <Skeleton className="h-8 w-full rounded-md lg:w-64" />
            </div>

            <div className="space-y-2">
              <div className="min-w-0 space-y-1">
                <Label className="text-sm leading-none font-medium">Visible only</Label>
                <p className="text-sm text-muted-foreground">Hide hidden and deprecated models.</p>
              </div>

              <div className="flex h-8 items-center">
                <Skeleton className="h-[1.15rem] w-8 rounded-full" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="min-w-0 space-y-1">
                <Label className="text-sm leading-none font-medium">Favorites only</Label>
                <p className="text-sm text-muted-foreground">Show only starred models.</p>
              </div>

              <div className="flex h-8 items-center">
                <Skeleton className="h-[1.15rem] w-8 rounded-full" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="rounded-md">
                <CardContent className="space-y-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-8 rounded-sm" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>

                    <Skeleton className="size-7 rounded-md" />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                    >
                      <Skeleton className="h-4 w-20" />
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    >
                      <Skeleton className="h-4 w-16" />
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
