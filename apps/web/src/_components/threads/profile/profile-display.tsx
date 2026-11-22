import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ButtonWithTip } from "@/components/ui/button";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import { useComposerModelConfig } from "@/lib/chat/composer-model-config";
import { cn } from "@/lib/utils";

export function ProfileDisplay({ profile }: { profile: Doc<"profiles"> }) {
  const { config, read, update } = useComposerModelConfig();

  const isActive = config.modelParams.profile === profile._id;
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
        // Toggle against the latest value, which a quick second click can be ahead of the rendered one.
        const nextProfile = read().modelParams.profile === profile._id ? null : profile._id;
        void update({ profile: nextProfile });
      }}
    >
      <Avatar className="size-full">
        <AvatarImage src={profileImageUrl} className="size-full object-cover object-center" />
        <AvatarFallback>{profile.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
    </ButtonWithTip>
  );
}
