import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic gate for /admin: no session cookie, straight to sign-in.
 * This is a convenience only. Every admin page, Server Action and Route
 * Handler verifies the session against the database itself.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has("lb_session")) {
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
