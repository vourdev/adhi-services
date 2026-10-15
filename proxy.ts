import { type NextRequest, NextResponse } from "next/server";

import { isBot } from "@/lib/analytics/classify";
import {
  VISITOR_COOKIE,
  VISITOR_MAX_AGE,
} from "@/lib/analytics/visitor-cookie";

/**
 * - /admin: optimistic gate, no session cookie means straight to sign-in.
 *   A convenience only; every admin page, Server Action and Route Handler
 *   verifies the session against the database itself.
 * - Public pages: the browser gets its visitor ID (lb_vid) on the first page
 *   load, so the view beacon and a link tapped right after it share one ID
 *   instead of each minting their own.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!request.cookies.has("lb_session")) {
      const url = new URL("/admin/login", request.url);
      if (pathname !== "/admin") url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const response = NextResponse.next();
  if (
    request.method === "GET" &&
    !request.cookies.has(VISITOR_COOKIE) &&
    !isBot(request.headers.get("user-agent"))
  ) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: VISITOR_MAX_AGE,
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    // Pages only: no API routes, redirects, media, Next internals or files with an extension.
    "/((?!api|_next|media|go|admin|.*\\..*).*)",
  ],
};
