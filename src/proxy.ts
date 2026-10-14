import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/setup"];

/**
 * Optimistic gate: no session cookie → redirect to /login before any protected page renders.
 * The cookie is fully verified (signature, expiry, user status) by every API route;
 * this only prevents a flash of the app for signed-out visitors.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("sv_session");
  if (!hasSession && !PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: skip API routes, Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
