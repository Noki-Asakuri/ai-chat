import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQuery } from "@tanstack/react-query";
import { Link, useLoaderData, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
  BrainIcon,
  ChartNoAxesColumnIcon,
  ChevronRightIcon,
  CircleUserRoundIcon,
  Columns3CogIcon,
  LogOutIcon,
  MessagesSquareIcon,
  PaperclipIcon,
  UserRoundPenIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Menu } from "../ui/menu";
import { Progress } from "../ui/progress";
import { Skeleton } from "../ui/skeleton";

import { logout } from "@/lib/authkit/logout";
import { getUserAvatarUrl, getUserDisplayName, getUserInitials } from "@/lib/authkit/user";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { getNavigationViewTransition } from "@/lib/navigation/view-transitions";
import { cn } from "@/lib/utils";

export function ThreadUserProfile() {
  const { user } = useLoaderData({ from: "/_chat" });
  const { data: currentUser } = useQuery(convexSessionQuery(api.functions.users.currentUser));
  const logoutUser = useServerFn(logout);

  if (!user) return null;

  const initials = getUserInitials(user);
  const username = getUserDisplayName(user);
  const avatarUrl = currentUser?.imageUrl ?? getUserAvatarUrl(user);

  return (
    <Menu.Root>
      <Menu.Trigger className="group flex w-full items-center gap-3 rounded-lg bg-sidebar-accent/60 p-2.5 text-left shadow-sm ring-1 ring-sidebar-border transition-[background-color,box-shadow,transform] outline-none hover:bg-sidebar-accent hover:ring-foreground/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 active:scale-[0.99] data-popup-open:bg-sidebar-accent data-popup-open:ring-primary/30">
        <Avatar className="size-10 shrink-0 rounded-lg ring-1 ring-foreground/10">
          <AvatarImage src={avatarUrl} alt={`${username} avatar`} />
          <AvatarFallback className="rounded-lg bg-primary text-sm text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium capitalize">{username}</p>
          <UserQuota variant="trigger" />
        </div>

        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-data-popup-open:translate-x-0.5 group-data-popup-open:text-primary" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner align="end" side="right" className="isolate z-50 outline-none" sideOffset={8}>
          <Menu.Popup className="flex max-h-(--available-height) w-72 origin-(--transform-origin) flex-col overflow-hidden rounded-xl bg-background/80 p-1.5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md backdrop-saturate-150 transition-[transform,scale,opacity] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="m-1 rounded-lg bg-muted/70 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-11 rounded-lg ring-1 ring-foreground/10">
                  <AvatarImage src={avatarUrl} alt={`${username} avatar`} />
                  <AvatarFallback className="rounded-lg bg-primary text-sm text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <p className="truncate font-medium capitalize">{username}</p>
                  <p className="truncate text-xs text-muted-foreground blur-xs transition-[filter] hover:blur-none">
                    {user.email}
                  </p>
                </div>
              </div>

              <UserQuota variant="panel" />
            </div>

            <Menu.Group className="mt-1">
              <Menu.GroupLabel className="px-2.5 py-1.5 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
                Account
              </Menu.GroupLabel>

              <UserMenuSettingItem href="/settings/account">
                <CircleUserRoundIcon />
                Account
              </UserMenuSettingItem>

              <UserMenuSettingItem href="/settings/customization">
                <Columns3CogIcon />
                Customize
              </UserMenuSettingItem>

              <UserMenuSettingItem href="/settings/profiles">
                <UserRoundPenIcon />
                Profiles
              </UserMenuSettingItem>
            </Menu.Group>

            <Menu.Group className="mt-1">
              <Menu.GroupLabel className="px-2.5 py-1.5 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
                Workspace
              </Menu.GroupLabel>

              <UserMenuSettingItem href="/settings/threads">
                <MessagesSquareIcon />
                Threads
              </UserMenuSettingItem>

              <UserMenuSettingItem href="/settings/statistics">
                <ChartNoAxesColumnIcon />
                Statistics
              </UserMenuSettingItem>

              <UserMenuSettingItem href="/settings/attachments">
                <PaperclipIcon />
                Attachments
              </UserMenuSettingItem>

              <UserMenuSettingItem href="/settings/models">
                <BrainIcon />
                Models
              </UserMenuSettingItem>
            </Menu.Group>

            <Menu.Separator className="mx-1 my-1.5 h-px bg-border" />

            <Menu.Item
              className="flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive transition-colors outline-none data-highlighted:bg-destructive/10"
              onClick={() => logoutUser()}
            >
              <LogOutIcon className="size-4" />
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

type UserMenuSettingItemProps = ComponentProps<typeof Menu.Item> & {
  href: string;
};

function UserMenuSettingItem({ className, children, href, ...props }: UserMenuSettingItemProps) {
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const rt = params?.threadId ? `/threads/${params.threadId}` : "/";

  return (
    <Menu.Item
      className={cn(
        "group flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&>svg:first-child]:size-4 [&>svg:first-child]:shrink-0 [&>svg:first-child]:text-muted-foreground data-highlighted:[&>svg:first-child]:text-primary",
        className,
      )}
      {...props}
      render={
        <Link
          preload={false}
          to={href}
          search={{ rt: params?.threadId }}
          viewTransition={getNavigationViewTransition(rt, href)}
        />
      }
    >
      {children}
      <ChevronRightIcon className="ml-auto size-3.5 text-muted-foreground/50 transition-transform group-data-highlighted:translate-x-0.5 group-data-highlighted:text-muted-foreground" />
    </Menu.Item>
  );
}

function UserQuota({ variant }: { variant: "panel" | "trigger" }) {
  const { data, isPending } = useQuery(convexSessionQuery(api.functions.usages.getUserUsages));
  if (isPending) {
    if (variant === "panel") {
      return (
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-1 w-full" />
        </div>
      );
    }

    return (
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-1 flex-1" />
        <Skeleton className="h-2.5 w-12" />
      </div>
    );
  }

  const used = data?.used ?? 0;
  const base = data?.base ?? 0;
  const percentage = data ? (used / base) * 100 : 0;

  if (variant === "trigger") {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <Progress
          className="min-w-0 flex-1 gap-0"
          value={percentage}
          aria-label={`${percentage.toFixed(2)}% of message quota used`}
        />
        <span className="font-mono text-[0.65rem] leading-none text-muted-foreground tabular-nums">
          {used}/{base}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Message usage</span>
        <span className="font-mono text-[0.7rem] tabular-nums">
          {used} / {base}
        </span>
      </div>
      <Progress value={percentage} aria-label={`${percentage.toFixed(2)}% of message quota used`} />
    </div>
  );
}
