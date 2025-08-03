import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import { env } from "@/env";

// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
Sentry.init({
  dsn: "https://1ffad1288df2ce70467f43c4005ea10e@o4509526933635072.ingest.us.sentry.io/4509526936256512",

  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  integrations: [
    Sentry.browserTracingIntegration(),
    // Replay may only be enabled for the client-side
    Sentry.replayIntegration(),
  ],

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: 1.0,
  // Capture Replay for 10% of all
  // plus for 100% of sessions with an error
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: "/relay-gTFD",
  ui_host: "https://us.posthog.com",
  capture_pageview: "history_change",
  person_profiles: "always",
});
