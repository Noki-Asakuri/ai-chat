import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { logger } from "@/lib/axiom/server";
import { transformMiddlewareRequest } from "@axiomhq/nextjs";

const isPublicRoute = createRouteMatcher(["/auth/login(.*)", "/auth/waitlist(.*)"]);

export default clerkMiddleware(async (auth, req, event) => {
  logger.info(...transformMiddlewareRequest(req));

  event.waitUntil(logger.flush());
  if (!isPublicRoute(req)) await auth.protect();

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
