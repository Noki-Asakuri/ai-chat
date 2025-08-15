import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { Meter } from "@base-ui-components/react/meter";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { format } from "@/lib/utils";

export function SettingsSidebar() {
  const { data } = useQuery(convexQuery(api.functions.users.currentUser, {}));
  const { data: usage, isPending: usagePending } = useQuery(
    convexQuery(api.functions.usages.getUsage, {}),
  );

  const fallback = data?.username
    ?.split(" ")
    .map((name) => name[0])
    .join("");

  return (
    <aside className="space-y-4">
      <div className="space-y-2">
        <Avatar className="mx-auto size-40">
          <AvatarImage
            src={data?.imageUrl as string | undefined}
            alt={`${data?.username} avatar`}
          />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>

        <div className="text-center">
          <h1 className="text-xl font-semibold capitalize">{data?.username}</h1>
          <p className="text-muted-foreground">{data?.emailAddress}</p>
          <Button variant="ghost" size="sm" className="mt-2 capitalize">
            Free Plan
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-xl">
            <span>Monthly Usage</span>

            {usage && (
              <span className="text-muted-foreground text-sm">
                {format.number(usage.used)} / {format.number(usage.base)}
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {usagePending || !usage ? (
            <p className="text-muted-foreground text-sm">Loading usage…</p>
          ) : (
            <Meter.Root
              className="box-border flex w-full items-center gap-2"
              value={(usage.used * 100) / usage.base}
            >
              <Meter.Track className="block h-4 w-full overflow-hidden rounded-md border">
                <Meter.Indicator className="bg-accent block transition-all duration-500" />
              </Meter.Track>

              <Meter.Value className="col-start-2 m-0 text-right text-sm leading-5">
                {(_, value) => `${value}%`}
              </Meter.Value>
            </Meter.Root>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Keyboard Shortcuts</CardTitle>
        </CardHeader>

        <CardContent>
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>Search Threads</span>
              <kbd className="bg-muted rounded-md border px-2 py-1 text-xs">Ctrl K</kbd>
            </li>

            <li className="flex justify-between">
              <span>Toggle Sidebar</span>
              <kbd className="bg-muted rounded-md border px-2 py-1 text-xs">Ctrl B</kbd>
            </li>

            <li className="flex justify-between">
              <span>New Chat</span>
              <kbd className="bg-muted rounded-md border px-2 py-1 text-xs">Ctrl Shift O</kbd>
            </li>
          </ul>
        </CardContent>
      </Card>
    </aside>
  );
}
