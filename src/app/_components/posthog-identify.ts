"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

export default function PostHogIdentify() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn && userId && user) {
      if (!posthog._isIdentified()) {
        posthog.identify(userId, { name: user.username }, { enviroment: process.env.NODE_ENV });
      }
    } else if (!isSignedIn) {
      posthog.reset();
    }
  }, [isLoaded, isSignedIn, userId, user]);

  return null;
}
