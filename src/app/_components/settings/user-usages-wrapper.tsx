import { api } from "@/convex/_generated/api";
import { preloadQuery } from "convex/nextjs";

import { auth } from "@clerk/nextjs/server";

import { UserUsages } from "./user-usages";

async function getPreloadUsages() {
  const { getToken } = await auth();

  const token = await getToken({ template: "convex" });
  return preloadQuery(api.functions.usages.getUserUsages, undefined, { token: token! });
}

export async function UserUsagesWrapper() {
  const preloaded = await getPreloadUsages();
  return <UserUsages preloaded={preloaded} />;
}
