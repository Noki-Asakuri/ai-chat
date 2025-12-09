import { createFileRoute } from "@tanstack/react-router";

import { WelcomeScreen } from "@/components/chat/welcome-screen";

export const Route = createFileRoute("/_chat_layout/")({
  preload: false,
  component: WelcomeScreen,
});
