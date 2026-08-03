// Clerk auth: everything requires login EXCEPT the extension's ingest endpoint,
// the health check, and Clerk's own sign-in/sign-up routes.
//
// /api/ingest can't do a Clerk login (it's called by the extension), so it's
// left public here and protected separately by a shared INGEST_TOKEN.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/ingest",
  "/api/health",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets...
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|map)).*)",
    // ...and always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
