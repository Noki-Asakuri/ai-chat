/* oxlint-disable react/no-array-index-key -- Static skeleton placeholders are positionally stable. */
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingProfilesSkeleton() {
  return (
    <output aria-label="Loading profiles" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 pb-1">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-8 w-28 sm:block" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-9 w-full sm:max-w-sm" />
        <Skeleton className="h-9 w-full sm:w-48" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-[94%]" />
              <Skeleton className="h-3 w-[86%]" />
              <Skeleton className="h-3 w-[60%]" />
            </div>
            <Skeleton className="mt-1 h-3 w-40" />
          </div>
        ))}
      </div>
    </output>
  );
}
