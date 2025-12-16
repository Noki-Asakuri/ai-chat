export type WorkOSUserLike = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePictureUrl: string | null;
  metadata: Record<string, string>;
};

const R2_PUBLIC_BASE_URL = "https://ik.imagekit.io/gmethsnvl/ai-chat";

export function getUserAvatarUrl(user: WorkOSUserLike): string | undefined {
  const avatarKey = user.metadata.avatarKey;
  if (avatarKey) return `${R2_PUBLIC_BASE_URL}/${avatarKey}`;

  const metadataAvatarUrl = user.metadata.avatarUrl;
  if (metadataAvatarUrl) return metadataAvatarUrl;

  return user.profilePictureUrl ?? undefined;
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

export function getUserInitials(user: WorkOSUserLike): string {
  const parts = [user.firstName, user.lastName].filter(isNonEmptyString);
  const initials = parts.map((p) => p.slice(0, 1)).join("");
  return initials.length > 0 ? initials : "U";
}

export function getUserDisplayName(user: WorkOSUserLike): string {
  const parts = [user.firstName, user.lastName].filter(isNonEmptyString);
  const name = parts.join(" ");
  return name.length > 0 ? name : "Unknown";
}