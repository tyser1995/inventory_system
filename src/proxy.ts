import { NextResponse, type NextRequest } from "next/server";
import { MAINTENANCE_MODE } from "@/lib/modes";

const PUBLIC = ["/login", "/setup"];
const MAINTENANCE_PAGE = "/maintenance";

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Maintenance mode: every page redirects to /maintenance and the API answers 503
 * (branding stays up so the maintenance page can show the logo).
 *
 * Otherwise an optimistic gate: no session cookie → redirect to /login before any protected page renders.
 * The cookie is fully verified (signature, expiry, user status) by every API route;
 * this only prevents a flash of the app for signed-out visitors.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = matches(pathname, "/api");

  if (MAINTENANCE_MODE) {
    if (isApi) {
      if (matches(pathname, "/api/branding")) return NextResponse.next();
      return NextResponse.json(
        { error: "The system is under maintenance. Please try again later." },
        { status: 503, headers: { "Retry-After": "3600" } },
      );
    }
    if (pathname === MAINTENANCE_PAGE) return NextResponse.next();
    return NextResponse.redirect(new URL(MAINTENANCE_PAGE, request.url));
  }

  if (isApi) return NextResponse.next();
  if (pathname === MAINTENANCE_PAGE) return NextResponse.redirect(new URL("/", request.url));

  const hasSession = request.cookies.has("sv_session");
  if (!hasSession && !PUBLIC.some((p) => matches(pathname, p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages and API routes (API only matters in maintenance mode); skip Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
