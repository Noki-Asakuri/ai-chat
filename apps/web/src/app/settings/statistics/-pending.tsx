import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingStatisticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="rounded-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <Skeleton className="h-5 w-20" />
            </CardHeader>

            <CardContent>
              <Skeleton className="h-9 w-18" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-md">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-full sm:w-[160px]" />
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="h-60 px-4 sm:px-10">
            <Skeleton className="h-full w-full" />
          </div>

          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-44" />
          </div>

          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-md">
            <CardHeader>
              <Skeleton className="h-7 w-40" />
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                <Skeleton className="h-72 w-full" />
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((__, itemIndex) => (
                    <div key={itemIndex} className="flex items-center gap-2">
                      <Skeleton className="size-3 rounded-full" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
