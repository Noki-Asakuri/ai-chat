import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingAttachmentsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-y py-3">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_auto]">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="gap-0 py-0">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <Skeleton className="h-8 w-full rounded-none" />
            <CardHeader className="py-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent className="pb-3">
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
            <div className="flex items-center justify-between border-t p-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-64 max-w-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      </div>
    </div>
  );
}
