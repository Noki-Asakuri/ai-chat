"use client";

import { useAuth, useUser } from "@clerk/react-router";
import posthog from "posthog-js";
import { useEffect } from "react";

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
