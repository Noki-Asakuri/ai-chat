import { useUser } from "@clerk/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsSidebar() {
  const { user } = useUser();

  const fallback = user?.username
    ?.split(" ")
    .map((name) => name[0])
    .join("");

  return (
    <aside className="space-y-4">
      <div className="space-y-2">
        <Avatar className="mx-auto size-40">
          <AvatarImage src={user?.imageUrl} alt={`${user?.username} avatar`} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>

        <div className="text-center">
          <h1 className="text-xl font-semibold capitalize">{user?.username}</h1>
          <p className="text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
          <Button variant="ghost" size="sm" className="mt-2">
            Free Plan
          </Button>
        </div>
      </div>

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
