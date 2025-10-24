import { transformMiddlewareRequest } from "@axiomhq/nextjs";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { env } from "@/env";
import { logger } from "@/lib/axiom/server";

const isProtectedRoute = createRouteMatcher(["/settings(.*)"]);

export default clerkMiddleware(
  async (auth, req, event) => {
    logger.info(...transformMiddlewareRequest(req));

    event.waitUntil(logger.flush());
    if (isProtectedRoute(req)) await auth.protect();

    return NextResponse.next();
  },
  {
    authorizedParties:
      env.NODE_ENV === "production"
        ? ["https://chat.asakuri.me", new URL(env.NEXT_PUBLIC_API_ENDPOINT).origin]
        : ["http://localhost:3000", "http://localhost:3001"],
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
