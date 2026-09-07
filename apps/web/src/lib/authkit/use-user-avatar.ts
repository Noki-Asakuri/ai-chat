import { api } from "@ai-chat/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { useLoaderData } from "@tanstack/react-router";
import { useEffect } from "react";

import { cacheUserAvatar } from "@/lib/authkit/avatar-cache";
import { getUserAvatarUrl, type WorkOSUserLike } from "@/lib/authkit/user";
import { convexSessionQuery } from "@/lib/convex/helpers";

export function useUserAvatar(
  user: WorkOSUserLike,
  profile: { imageUrl?: string | null } | null | undefined,
): string | undefined {
  const { auth, cachedAvatarUrl } = useLoaderData({ from: "__root__" });
  if (profile !== undefined) return profile?.imageUrl ?? getUserAvatarUrl(user);

  return (auth.user?.id === user.id ? cachedAvatarUrl : undefined) ?? getUserAvatarUrl(user);
}

export function AvatarCacheSync() {
  const { auth } = useLoaderData({ from: "__root__" });
  const userId = auth.user?.id;
  const { data: chatShell } = useQuery({
    ...convexSessionQuery(api.functions.users.getChatShell),
    enabled: !!userId,
  });
  const viewer = chatShell?.viewer;

  useEffect(() => {
    if (userId && viewer) cacheUserAvatar(userId, viewer.imageUrl);
  }, [userId, viewer]);

  return null;
}
