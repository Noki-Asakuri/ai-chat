import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";

import { useQuery } from "@tanstack/react-query";
import { Link, useLoaderData, useParams } from "@tanstack/react-router";

import {
  BrainIcon,
  ChartNoAxesColumnIcon,
  CircleUserRoundIcon,
  Columns3CogIcon,
  LogOutIcon,
  PaperclipIcon,
  UserRoundPenIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Menu } from "../ui/menu";

import { cn } from "@/lib/utils";

export function ThreadUserProfile() {
  const { user } = useLoaderData({ from: "/_chat_layout" });
  if (!user) return null;

  const fallback = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((name) => name![0])
    .join("");

  const username = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <Menu.Root>
      <Menu.Trigger className="flex gap-2 rounded-md border border-transparent p-2 transition-colors hover:border-primary/30 hover:bg-primary/20 data-popup-open:border-primary/30 data-popup-open:bg-primary/20">
        <Avatar className="size-11 rounded-md">
          <AvatarImage src={user.profilePictureUrl as string} alt={`${username} avatar`} />
          <AvatarFallback className="bg-primary text-sm text-primary-foreground">
            {fallback}
          </AvatarFallback>
        </Avatar>

        <div className="ml-1 flex h-full w-full flex-col justify-center text-left">
          <p className="font-medium capitalize">{username}</p>
          <UserQuota />
        </div>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Backdrop />
        <Menu.Positioner align="end" side="right" className="outline-none" sideOffset={8}>
          <Menu.Popup className="flex origin-(--transform-origin) flex-col gap-0.5 rounded-md border border-primary/30 bg-[#342e4a] p-2 text-card-foreground transition-[transform,scale,opacity] data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0">
            <UserMenuSettingItem href="/settings/account">
              <CircleUserRoundIcon className="size-5" />
              Account
            </UserMenuSettingItem>

            <UserMenuSettingItem href="/settings/statistics">
              <ChartNoAxesColumnIcon className="size-5" />
              Statistics
            </UserMenuSettingItem>

            <UserMenuSettingItem href="/settings/customize">
              <Columns3CogIcon className="size-5" />
              Customize
            </UserMenuSettingItem>

            <UserMenuSettingItem href="/settings/attachments">
              <PaperclipIcon className="size-5" />
              Attachments
            </UserMenuSettingItem>

            <UserMenuSettingItem href="/settings/models">
              <BrainIcon className="size-5" />
              Models
            </UserMenuSettingItem>

            <UserMenuSettingItem href="/settings/ai-profiles">
              <UserRoundPenIcon className="size-5" />
              Profiles
            </UserMenuSettingItem>

            <Menu.Separator className="my-1 h-px bg-primary/30" />

            <Menu.Item
              className="flex w-full cursor-pointer items-center justify-start gap-1.5 rounded-md px-1.5 py-1 text-sm text-destructive transition-colors hover:bg-destructive/20"
              render={<Link preload={false} to="/auth/logout" />}
            >
              <LogOutIcon className="size-5" />
              Logout
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
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });

  return (
    <Menu.Item
      className={cn(
        "flex w-full cursor-pointer items-center justify-start gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-primary/20",
        className,
      )}
      {...props}
      render={<Link preload={false} to={href} search={{ rt: params?.threadId }} />}
    >
      {children}
    </Menu.Item>
  );
}

function UserQuota() {
  const { data, isPending } = useQuery(convexQuery(api.functions.usages.getUserUsages));
  if (isPending || !data) return null;

  const percentage = (data.used / data.base) * 100;

  return (
    <span className="text-sm">
      {data.used} / {data.base} ({percentage.toFixed(2)}%)
    </span>
  );
}
