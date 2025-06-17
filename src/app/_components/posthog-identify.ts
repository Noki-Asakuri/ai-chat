"use client";

import { useUser } from "@clerk/react-router";
import { useLocalStorage } from "@uidotdev/usehooks";
import posthog from "posthog-js";
import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

import { fromUUID } from "@/lib/utils";

export default function PostHogIdentify() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [distinctId, setDistinctId] = useLocalStorage<string | null>("posthog_distinct_id", null);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      if (!posthog._isIdentified()) {
        posthog.identify(
          user.id,
          { name: user.username, userId: user.id },
          { enviroment: process.env.NODE_ENV },
        );
      }
    } else {
      const id = distinctId ?? `anon_${fromUUID(uuidv4())}`;
      setDistinctId(id);

      posthog.identify(id, { name: "anonymous", userId: id }, { enviroment: process.env.NODE_ENV });
    }
  }, [distinctId, isLoaded, isSignedIn, setDistinctId, user]);

  return null;
}
