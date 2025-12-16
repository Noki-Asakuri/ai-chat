import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingStatisticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="rounded-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <Skeleton className="h-5 w-20" />
            </CardHeader>

            <CardContent>
              <Skeleton className="h-9 w-16" />
              <Skeleton className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <Skeleton className="h-7 w-56" />
        </CardHeader>

        <CardContent className="space-y-3">
          <Skeleton className="h-59" />

          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>

          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="rounded-md">
            <CardHeader>
              <Skeleton className="h-7 w-40" />
            </CardHeader>

            <CardContent>
              <Skeleton className="h-[220px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
