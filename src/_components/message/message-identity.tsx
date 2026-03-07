import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Icons } from "../ui/icons";

import { getUserAvatarUrl, getUserDisplayName, type WorkOSUserLike } from "@/lib/authkit/user";
import { tryGetModelData, type Provider } from "@/lib/chat/models";
import type { MessageUserIdentity, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageAssistantIdentity = {
  displayName: string;
  provider: Provider;
  effortLabel?: string;
};

type MessageIdentity =
  | {
      kind: "user";
      user: MessageUserIdentity;
    }
  | {
      kind: "assistant";
      assistant: MessageAssistantIdentity;
    };

export function buildMessageUserIdentity(user: WorkOSUserLike): MessageUserIdentity {
  return {
    displayName: getUserDisplayName(user),
    avatarUrl: getUserAvatarUrl(user),
  };
}

export function getMessageIdentity(
  message: ChatMessage,
  userIdentity: MessageUserIdentity,
): MessageIdentity {
  if (message.role === "user") {
    return {
      kind: "user",
      user: userIdentity,
    };
  }

  return {
    kind: "assistant",
    assistant: buildAssistantMessageIdentity(
      message.metadata?.model.request,
      message.metadata?.modelParams.effort,
    ),
  };
}

export function buildAssistantMessageIdentity(
  modelId: string | null | undefined,
  effort: string | null | undefined,
): MessageAssistantIdentity {
  const modelData = tryGetModelData(modelId);

  if (!modelData) {
    return {
      displayName: "Assistant",
      provider: "openai",
    };
  }

  const effortLabel =
    modelData.capabilities.reasoning === true &&
    effort !== undefined &&
    effort !== null &&
    effort !== "medium" &&
    effort !== "none"
      ? effort
      : undefined;

  return {
    displayName: modelData.display.name,
    provider: modelData.provider,
    effortLabel,
  };
}

export function MessageIdentityAvatar({
  identity,
  className,
}: {
  identity: MessageIdentity;
  className?: string;
}) {
  if (identity.kind === "user") {
    return (
      <Avatar className={cn("size-10 rounded-full ring-1 ring-border/70", className)}>
        <AvatarImage alt="" src={identity.user.avatarUrl ?? undefined} />
        <AvatarFallback>{getInitialsFromDisplayName(identity.user.displayName)}</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar
      className={cn(
        "size-10 rounded-full border border-border/60 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)/0.84))] text-foreground shadow-sm",
        className,
      )}
    >
      <AvatarFallback className="bg-transparent text-foreground">
        <Icons.provider provider={identity.assistant.provider} className="size-5" />
      </AvatarFallback>
    </Avatar>
  );
}

export function MessageIdentityHeader({
  identity,
  className,
}: {
  identity: MessageIdentity;
  className?: string;
}) {
  if (identity.kind === "user") {
    return (
      <div className={cn("text-sm font-semibold text-foreground", className)}>
        {identity.user.displayName}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="font-semibold text-foreground">{identity.assistant.displayName}</span>

      {identity.assistant.effortLabel && (
        <span className="text-xs font-medium text-muted-foreground capitalize">
          ({identity.assistant.effortLabel})
        </span>
      )}
    </div>
  );
}

function getInitialsFromDisplayName(displayName: string): string {
  const parts = displayName
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return "U";

  let initials = "";

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part) continue;
    initials += part.slice(0, 1);
    if (initials.length >= 2) break;
  }

  return initials.toUpperCase();
}

export type { MessageIdentity };
