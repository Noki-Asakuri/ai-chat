import { Skeleton } from "@/components/ui/skeleton";

export function LoadingStatisticsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading statistics" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y py-5 lg:grid-cols-4">
        {["tokens", "responses", "messages", "conversations"].map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-72" />
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {["models", "providers", "profiles"].map((key) => (
          <div key={key} className="flex flex-col gap-3 border-t pt-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
