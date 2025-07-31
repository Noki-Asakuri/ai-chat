import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { Logger } from "next-axiom";

const isPublicRoute = createRouteMatcher(["/auth/login(.*)", "/auth/waitlist(.*)"]);

export default clerkMiddleware(async (auth, req, event) => {
  const logger = new Logger({ source: "middleware" }); // traffic, request
  logger.middleware(req);

  event.waitUntil(logger.flush());
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
