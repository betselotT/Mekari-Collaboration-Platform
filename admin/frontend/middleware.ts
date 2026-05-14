import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "mekari_admin_session";
const ADMIN_SESSION_TOKEN =
  process.env.ADMIN_SESSION_TOKEN || "mekari-admin-seeded-session";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const hasSession = req.cookies.get(ADMIN_SESSION_COOKIE)?.value === ADMIN_SESSION_TOKEN;

  if (pathname === "/login") {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
