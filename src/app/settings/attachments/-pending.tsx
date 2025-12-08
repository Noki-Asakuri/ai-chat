import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Attachments</h2>
        <p className="text-muted-foreground">View and manage your attachments.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex w-full flex-col rounded-md border">
            <Skeleton className="relative aspect-square size-full rounded-none" />

            <div className="flex flex-col gap-1 border-t p-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>

              <Skeleton className="h-5 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
