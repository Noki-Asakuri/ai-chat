import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Models</h2>
        <p className="text-muted-foreground">
          Choose which models are visible in the model picker.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Search models</Label>
        <Input disabled className="bg-input/30" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="rounded-md">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-sm" />
                <div className="space-y-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Button disabled>Save</Button>
        <Button disabled variant="outline">
          Reset
        </Button>
      </div>
    </div>
  );
}
