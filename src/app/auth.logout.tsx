import { createFileRoute } from "@tanstack/react-router";

import { signOut } from "@/lib/authkit/serverFunctions";

export const Route = createFileRoute("/auth/logout")({
  preload: false,
  loader: async () => await signOut(),
});
