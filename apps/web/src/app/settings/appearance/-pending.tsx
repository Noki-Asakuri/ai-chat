import { SettingsSection } from "@/components/settings/settings-section";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const BEHAVIOR_OPTIONS = [
  "How to send messages",
  "Play chat completion sound",
  "Desktop notifications",
  "Wrap long code lines",
  "Performance mode",
  "Show full code by default",
] as const;

export function LoadingAppearanceSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Changes save automatically.</p>
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>

      <section className="flex flex-col">
        <div className="flex items-start justify-between gap-4 pb-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-8 w-48 rounded-md" />
        </div>
        {["Interface font", "Prompt font", "Code font"].map((title, index) => (
          <div key={title}>
            {index > 0 && <Separator />}
            <div className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:gap-x-8">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full max-w-60" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              {index > 0 && (
                <Skeleton
                  className={
                    index === 2
                      ? "h-24 w-full rounded-lg md:col-span-2"
                      : "h-12 w-full rounded-lg md:col-span-2"
                  }
                />
              )}
            </div>
          </div>
        ))}
      </section>

      <SettingsSection
        id="interaction"
        title="Interaction"
        description="Control how chat input, notifications, and code behave."
      >
        {BEHAVIOR_OPTIONS.map((title, index) => (
          <div key={title}>
            {index > 0 && <Separator />}
            <div className="flex items-center gap-3 py-4">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full max-w-sm" />
              </div>
              <Skeleton
                className={
                  index === 0 ? "h-8 w-48 shrink-0 rounded-md" : "h-[1.15rem] w-8 shrink-0 rounded-full"
                }
              />
            </div>
          </div>
        ))}
      </SettingsSection>

      <div className="max-w-3xl">
        <SettingsSection
          id="chat-background"
          title="Chat background"
          description="Add a personal image behind your conversations."
        >
          <div>
            <Skeleton className="aspect-[16/10] w-full rounded-md" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
