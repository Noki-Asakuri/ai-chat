import { useUser } from "@clerk/react-router";

import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";

export function UserAvatar() {
  const { user } = useUser();

  return (
    <Avatar className="size-11 shrink-0 rounded-md border">
      {user && <AvatarImage src={user.imageUrl} alt={user.username!} />}
      <AvatarFallback className="size-full rounded-md bg-muted">You</AvatarFallback>
    </Avatar>
  );
}
