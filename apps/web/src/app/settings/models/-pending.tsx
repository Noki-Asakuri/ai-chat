/* oxlint-disable react/no-array-index-key -- Static skeleton placeholders are positionally stable. */
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div aria-label="Loading models" aria-busy="true" className="flex flex-col">
      <div className="flex flex-col gap-3 border-b pt-1 pb-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-28" />
          ))}
        </div>
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="flex h-14 items-center gap-3 px-2">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto size-7" />
            <Skeleton className="h-5 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
