import type { Doc } from "@/convex/_generated/dataModel";

import { ButtonWithTip } from "@/components/ui/button";
import { Avatar } from "@base-ui-components/react/avatar";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ProfileDisplay({ profile }: { profile: Doc<"profiles"> }) {
  const activeProfile = useChatStore((state) => state.chatConfig.profile);
  const isActive = activeProfile?.id === profile._id;

  return (
    <ButtonWithTip
      side="right"
      variant="none"
      title={profile.name}
      className={cn(
        "size-9 overflow-hidden rounded-md p-0",
        isActive ? "bg-primary/40 ring-2 ring-primary ring-offset-4 ring-offset-sidebar/80" : "",
      )}
      onClick={() =>
        useChatStore.getState().setChatConfig({
          profile: isActive
            ? null
            : { id: profile._id, name: profile.name, systemPrompt: profile.systemPrompt },
        })
      }
    >
      <Avatar.Root className="size-full">
        <Avatar.Image
          src={`https://ik.imagekit.io/gmethsnvl/ai-chat/${profile.imageKey}`}
          className="size-full object-cover object-center"
        />
        <Avatar.Fallback>{profile.name.slice(0, 2)}</Avatar.Fallback>
      </Avatar.Root>
    </ButtonWithTip>
  );
}
