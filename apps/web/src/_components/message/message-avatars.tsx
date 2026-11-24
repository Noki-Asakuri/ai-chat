import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQuery } from "@tanstack/react-query";
import { useLoaderData } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Icons } from "../ui/icons";

import { useUserAvatar } from "@/lib/authkit/use-user-avatar";
import type { tryGetModelData } from "@/lib/chat/models";
import { convexQuery } from "@convex-dev/react-query";
import { cn } from "@/lib/utils";

export function UserMessageAvatar({ className }: { className?: string }) {
  const { user } = useLoaderData({ from: "/_chat" });
  const { data: chatShell } = useQuery(convexQuery(api.functions.users.getChatShell));

  const avatarUrl = useUserAvatar(user, chatShell?.viewer);

  return (
    <Avatar data-slot="message-avatar" className={cn("size-7 sm:size-9", className)}>
      <AvatarFallback className="text-xs">{user?.firstName?.slice(0, 2) || "You"}</AvatarFallback>
      <AvatarImage
        keepMounted
        alt=""
        className="absolute inset-0 mt-0 mb-0 data-error:invisible data-loading:invisible"
        src={avatarUrl}
      />
    </Avatar>
  );
}

type ModelData = ReturnType<typeof tryGetModelData>;

export function ProviderAvatar({ modelData, className }: { modelData: ModelData; className?: string }) {
  return (
    <Avatar data-slot="message-avatar" className={cn("size-9", className)}>
      <AvatarFallback className="bg-background">
        {modelData ? (
          <Icons.provider provider={modelData.provider} className="size-[55%]" />
        ) : (
          <Icons.unknown className="size-[55%]" />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
