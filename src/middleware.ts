import { clerkMiddleware } from "@clerk/nextjs/server";
import { getCookie, setCookie } from "cookies-next";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  let identifier: string | null = null;
  if (userId) {
    identifier = userId;
  } else {
    const anonId = await getCookie("anon_session_id", { req });
    if (anonId) {
      identifier = anonId;
    } else {
      identifier = `anon_${crypto.randomUUID()}`;

      const response = NextResponse.next();
      await setCookie("anon_session_id", identifier, {
        req: req,
        res: response,
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365,
      });

      req.headers.set("X-Rate-Limit-Identifier", identifier);
      return response;
    }
  }

  req.headers.set("X-Rate-Limit-Identifier", identifier);
  return NextResponse.next({ request: { headers: req.headers } });
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
