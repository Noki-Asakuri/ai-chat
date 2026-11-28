import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { buildImageAssetUrl, buildImageThumbnailUrl } from "@/lib/assets/urls";
import { getProfileInitials } from "@/lib/profiles/profile-library";
import { cn } from "@/lib/utils";

// Twice the largest size it is drawn at, so it stays sharp on high-density screens.
const PROFILE_AVATAR_TRANSFORM = "tr=w-160,h-160,c-at_max,f-auto,q-80";

export function getProfileImageUrl(imageKey: string | undefined): string | undefined {
  if (!imageKey) return undefined;
  return buildImageThumbnailUrl(buildImageAssetUrl(imageKey), PROFILE_AVATAR_TRANSFORM);
}

/** A profile's picture, or its initials on the accent color when it has none. */
export function ProfileAvatar({
  name,
  imageKey,
  src,
  className,
  fallbackClassName,
}: {
  name: string;
  imageKey?: string;
  /** A picture to show instead of the stored one, like a file about to be uploaded. */
  src?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={cn("size-8 rounded-full after:rounded-full", className)}>
      <AvatarImage src={src ?? getProfileImageUrl(imageKey)} alt="" />
      <AvatarFallback
        className={cn(
          "rounded-full bg-primary/14 font-medium tracking-tight text-primary",
          fallbackClassName,
        )}
      >
        {getProfileInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
