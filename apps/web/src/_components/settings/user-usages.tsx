import { api } from "@ai-chat/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";

import { Meter } from "@base-ui/react/meter";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { format } from "@/lib/utils";

export function UserUsages() {
  const { data } = useQuery(convexSessionQuery(api.functions.usages.getUserUsages));
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-xl">
          <span>{data.resetType === "daily" ? "Daily" : "Monthly"} Usages</span>

          <span className="text-sm text-muted-foreground">
            {format.number(data.used)} / {format.number(data.base)}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Meter.Root
          className="box-border flex w-full items-center gap-2"
          value={(data.used * 100) / data.base}
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
