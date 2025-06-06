import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { serverConvexClient } from "@/lib/convex/server";
import { api } from "@/convex/_generated/api";

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);

    switch (evt.type) {
      case "user.created":
        console.log("User created", evt.data);
        break;

      case "user.updated":
        console.log("User updated", evt.data);
        break;

      case "user.deleted":
        console.log("User deleted", evt.data);
        // await serverConvexClient.mutation(api.users.deleteUser, { userId: evt.data.id! });
        break;

      default:
        console.log("Unknown event", evt.type);
        break;
    }

    return new Response("Webhook received", { status: 200 });
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error verifying webhook", { status: 400 });
  }
}
