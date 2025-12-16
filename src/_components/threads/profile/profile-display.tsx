import type { Doc } from "@/convex/_generated/dataModel";

import { Avatar } from "@base-ui/react/avatar";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";
import { ButtonWithTip } from "@/components/ui/button";

import { cn } from "@/lib/utils";

export function ProfileDisplay({ profile }: { profile: Doc<"profiles"> }) {
  const configStore = useConfigStoreState();
  const state = useConfigStore((state) => state);

  const isActive = state.profile === profile._id;

  return (
    <ButtonWithTip
      side="right"
      variant="none"
      data-active={isActive}
      title={profile.name}
      className={cn(
        "size-9 overflow-hidden rounded-md p-0",
        isActive ? "bg-primary/40 ring-2 ring-primary ring-offset-4 ring-offset-sidebar/80" : "",
      )}
      onClick={() => configStore.setConfig({ profile: isActive ? null : profile._id })}
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
