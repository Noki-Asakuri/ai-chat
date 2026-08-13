import { SettingsSection } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <SettingsSection
      id="model-library"
      title="Model library"
      description="Filter the catalog, choose what appears in the picker, and keep frequently used models close."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 border-y py-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Badge key={index} variant="outline">
              <Skeleton className="h-4 w-18" />
            </Badge>
          ))}
          <Skeleton className="ml-auto h-8 w-32 rounded-md" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)_minmax(13rem,16rem)_minmax(13rem,16rem)] lg:items-start">
          <div className="flex flex-col gap-2">
            <Label>Search models</Label>
            <Input disabled className="bg-input/30" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Capability</Label>
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="rounded-md">
              <CardContent className="flex flex-col gap-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-8 rounded-sm" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="size-7 rounded-md" />
                </div>
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-20 rounded-sm" />
                  <Skeleton className="h-5 w-16 rounded-sm" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
