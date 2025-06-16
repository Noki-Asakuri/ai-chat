import posthog from "posthog-js";
import { env } from "@/env";

posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: "/relay-gTFD",
  ui_host: "https://us.posthog.com",
  capture_pageview: "history_change",
  person_profiles: "always",
});
