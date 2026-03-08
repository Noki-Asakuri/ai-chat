import type { Doc } from "@/convex/_generated/dataModel";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ButtonWithTip } from "@/components/ui/button";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import { cn } from "@/lib/utils";

export function ProfileDisplay({ profile }: { profile: Doc<"profiles"> }) {
  const configStore = useConfigStoreState();
  const state = useConfigStore((state) => state);

  const isActive = state.profile === profile._id;
  const profileImageUrl = profile.imageKey ? buildImageAssetUrl(profile.imageKey) : undefined;

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
      <Avatar className="size-full">
        <AvatarImage src={profileImageUrl} className="size-full object-cover object-center" />
        <AvatarFallback>{profile.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
    </ButtonWithTip>
  );
}
