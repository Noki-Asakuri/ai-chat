import { api } from "@/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { ProfileDisplay } from "./profile-display";

import { useChatStore } from "@/lib/chat/store";

export function ThreadProfileSidebar() {
  const { data, isPending } = useQuery(convexQuery(api.functions.profiles.listProfiles, {}));

  useEffect(() => {
    if (data) useChatStore.getState().setProfiles(data);
  }, [data]);

  if (isPending || !data) return null;

  return (
    <div
      data-slot="thread-profile-sidebar"
      className="absolute top-10 right-0 z-50 flex h-[calc(100%-40px)] w-14 flex-col items-start gap-4 border-x border-b bg-sidebar/80 p-2 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar"
    >
      {data.map((profile) => (
        <ProfileDisplay key={profile._id} profile={profile} />
      ))}
    </div>
  );
}
