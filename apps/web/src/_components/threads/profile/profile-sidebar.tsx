import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQuery } from "@tanstack/react-query";

import { ProfileDisplay } from "./profile-display";

import { convexSessionQuery } from "@/lib/convex/helpers";

export function ThreadProfileSidebar() {
  const { data, isPending } = useQuery(convexSessionQuery(api.functions.profiles.listProfiles));
  if (isPending || !data || data.length === 0) return null;

  return (
    <div
      data-count={data.length}
      data-slot="thread-profile-sidebar"
      className="absolute top-10 right-0 z-50 flex h-[calc(100%-40px)] w-14 flex-col items-start gap-4 border-x border-b bg-sidebar/80 p-2 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar"
    >
      {data.map((profile) => (
        <ProfileDisplay key={profile._id} profile={profile} />
      ))}
    </div>
  );
}
