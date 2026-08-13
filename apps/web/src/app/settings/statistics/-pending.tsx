import { SettingsSection } from "@/components/settings/settings-section";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingStatisticsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        id="overview"
        title="Overview"
        description="A quick summary of your conversation and token activity."
      >
        <div className="grid border-y md:grid-cols-3 md:divide-x">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="border-t py-5 first:border-t-0 md:border-t-0 md:px-6 md:first:pl-0 md:last:pr-0"
            >
              <Skeleton className="h-5 w-20" />
              <Skeleton className="mt-2 h-9 w-18" />
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
      </SettingsSection>

      <Separator />

      <SettingsSection
        id="activity"
        title="Activity"
        description="Daily user message activity and total token usage for the selected year."
        actions={<Skeleton className="h-10 w-full sm:w-40" />}
      >
        <div className="flex flex-col gap-3">
          <div className="h-60 px-4 sm:px-10">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-3 w-40" />
        </div>
      </SettingsSection>

      <Separator />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <SettingsSection key={index} id={`chart-${index}`} title="Usage breakdown">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
              <Skeleton className="h-72 w-full" />
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((__, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-2">
                    <Skeleton className="size-3 rounded-full" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                ))}
              </div>
            </div>
          </SettingsSection>
        ))}
      </div>
    </div>
  );
}
