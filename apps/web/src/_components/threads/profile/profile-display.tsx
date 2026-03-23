import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ButtonWithTip } from "@/components/ui/button";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import { useSyncThreadModelConfig } from "@/lib/chat/server-function/sync-thread-model-config";
import { cn } from "@/lib/utils";

export function ProfileDisplay({ profile }: { profile: Doc<"profiles"> }) {
  const configStore = useConfigStoreState();
  const { syncThreadModelConfig } = useSyncThreadModelConfig();
  const state = useConfigStore((state) => state);

  const isActive = state.modelParams.profile === profile._id;
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
      onClick={() => {
        const nextProfile = isActive ? null : profile._id;
        configStore.setModelParams({ profile: nextProfile });
        void syncThreadModelConfig({ modelParams: { profile: nextProfile } });
      }}
    >
      <Avatar className="size-full">
        <AvatarImage src={profileImageUrl} className="size-full object-cover object-center" />
        <AvatarFallback>{profile.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
    </ButtonWithTip>
  );
}
