"use client";

import type { api } from "@/convex/_generated/api";
import { usePreloadedQuery, type Preloaded } from "convex/react";

import { Meter } from "@base-ui-components/react/meter";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

import { format } from "@/lib/utils";

export function UserUsages({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.functions.usages.getUserUsages>;
}) {
  const usages = usePreloadedQuery(preloaded);
  if (!usages) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-xl">
          <span>{usages.resetType === "daily" ? "Daily" : "Monthly"} Usages</span>

          {usages && (
            <span className="text-sm text-muted-foreground">
              {format.number(usages.used)} / {format.number(usages.base)}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Meter.Root
          className="box-border flex w-full items-center gap-2"
          value={(usages.used * 100) / usages.base}
        >
          <Meter.Track className="block h-4 w-full overflow-hidden rounded-md border">
            <Meter.Indicator className="block bg-accent transition-all duration-500" />
          </Meter.Track>

          <Meter.Value className="col-start-2 m-0 text-right text-sm leading-5">
            {(_, value) => `${value}%`}
          </Meter.Value>
        </Meter.Root>
      </CardContent>
    </Card>
  );
}
