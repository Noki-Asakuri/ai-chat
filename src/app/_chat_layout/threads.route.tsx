import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_chat_layout/threads")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/threads" || location.pathname === "/threads/") {
      throw redirect({ to: "/", statusCode: 301 });
    }
  },
});
