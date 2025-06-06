import { useUser } from "@clerk/nextjs";

import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";

export function UserAvatar() {
  const { user } = useUser();

  return (
    <Avatar className="size-11 shrink-0 rounded-md border">
      {user && <AvatarImage src={user.imageUrl} alt={user.username!} />}
      <AvatarFallback className="bg-muted size-full rounded-md">You</AvatarFallback>
    </Avatar>
  );
}
