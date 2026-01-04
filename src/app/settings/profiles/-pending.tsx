import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingProfilesListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <Skeleton className="h-5 w-40" />
            <div className="flex items-center gap-1">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </CardHeader>

          <CardContent className="flex items-start gap-3">
            <Skeleton className="size-16 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[84%]" />
              <Skeleton className="h-4 w-[66%]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
