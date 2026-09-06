import { Skeleton } from "@/components/ui/skeleton";

export function LoadingStatisticsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading statistics" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-4 border-y py-3 lg:grid-cols-4">
        {["messages", "responses", "conversations", "tokens"].map((key) => (
          <div key={key} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        {["models", "profiles"].map((key) => (
          <div key={key} className="flex flex-col gap-3">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
