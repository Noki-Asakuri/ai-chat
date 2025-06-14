import "server-only";
import { PostHog } from "posthog-node";

import { env } from "@/env";

export function PostHogClient() {
  const posthogClient = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
    flushInterval: 0,
    flushAt: 1,
  });

  return posthogClient;
}

export const getDistinctId = (req: Request) => {
  try {
    const uniqueId = /ph_phc_.*?_posthog=([^;]+)/.exec(req.headers.get("cookie") ?? "")![1]!;
    const data = JSON.parse(decodeURIComponent(uniqueId)) as { distinct_id: string };
    return data.distinct_id;
  } catch (e) {
    console.error("Error parsing PostHog cookie:", e);
    return "anonymous";
  }
};
