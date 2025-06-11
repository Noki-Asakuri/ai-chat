import { useUser } from "@clerk/nextjs";
import Link from "next/link";

import { AvatarImage, Avatar, AvatarFallback } from "../ui/avatar";

export function ThreadUserProfile() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded || !isSignedIn) return null;

  const fallback = user.username
    ?.split(" ")
    .map((name) => name[0])
    .join("");

  return (
    <Link
      prefetch={false}
      href="/auth/settings"
      className="hover:bg-primary/20 hover:border-primary/30 flex gap-2 rounded-md border border-transparent p-2 transition-colors"
    >
      <Avatar className="size-11 rounded-md">
        <AvatarImage src={user.imageUrl} alt={user.username!} />
        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
          {fallback}
        </AvatarFallback>
      </Avatar>

      <div className="ml-1 flex flex-col justify-center">
        <p className="text-sm font-medium capitalize">{user.username}</p>
        <p className="text-muted-foreground text-sm">Settings</p>
      </div>
    </Link>
  );
}
