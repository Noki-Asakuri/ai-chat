import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/logout")({
  beforeLoad: function () {
    throw redirect({ to: "/" });
  },
});
