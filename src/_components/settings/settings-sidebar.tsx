import { currentUser } from "@clerk/nextjs/server";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { UserUsagesWrapper } from "./user-usages-wrapper";

export function SettingsSidebar() {
  return (
    <aside className="space-y-4">
      <UserInfo />
      <UserUsagesWrapper />
      <KeyboardShortcuts />
    </aside>
  );
}

async function UserInfo() {
  const user = await currentUser();
  if (!user) return null;

  const fallback = user.username
    ?.split(" ")
    .map((name) => name[0])
    .join("");

  const mainEmailAddress = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );

  return (
    <div className="space-y-2">
      <Avatar className="mx-auto size-40">
        <AvatarImage src={user?.imageUrl as string | undefined} alt={`${user?.username} avatar`} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>

      <div className="text-center">
        <h1 className="text-xl font-semibold capitalize">{user.username}</h1>
        <p className="text-muted-foreground blur-xs hover:blur-none">
          {mainEmailAddress?.emailAddress}
        </p>

        <Button variant="ghost" size="sm" className="mt-2 capitalize">
          Free Plan
        </Button>
      </div>
    </div>
  );
}

function KeyboardShortcuts() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Keyboard Shortcuts</CardTitle>
      </CardHeader>

      <CardContent>
        <ul className="space-y-2">
          <li className="flex justify-between">
            <span>Search Threads</span>
            <kbd className="rounded-md border bg-muted px-2 py-1 text-xs">Ctrl K</kbd>
          </li>

          <li className="flex justify-between">
            <span>Toggle Sidebar</span>
            <kbd className="rounded-md border bg-muted px-2 py-1 text-xs">Ctrl B</kbd>
          </li>

          <li className="flex justify-between">
            <span>New Chat</span>
            <kbd className="rounded-md border bg-muted px-2 py-1 text-xs">Ctrl Shift O</kbd>
          </li>

          <li className="flex justify-between">
            <span>Open Model Picker</span>
            <kbd className="rounded-md border bg-muted px-2 py-1 text-xs">Ctrl M</kbd>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
