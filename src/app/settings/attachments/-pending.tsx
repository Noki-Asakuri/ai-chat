import { Skeleton } from "@/components/ui/skeleton";

export function LoadingAttachmentsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-28" />
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <Skeleton className="h-9 w-full" />

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-8 w-[170px]" />
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="ml-auto h-8 w-20" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex w-full flex-col rounded-md border">
            <Skeleton className="relative aspect-square size-full rounded-none" />

            <div className="flex flex-col gap-1 border-t p-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>

              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-44" />

          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>

        <div className="flex justify-center gap-2">
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
        </div>
      </div>
    </div>
  );
}
