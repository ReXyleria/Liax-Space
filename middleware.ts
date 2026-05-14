import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (process.env.SETUP_REQUIRED === "true" && !isSetupSafePath(pathname)) {
    const setupUrl = new URL("/setup", request.url);
    setupUrl.searchParams.set("reason", "migration");
    return NextResponse.redirect(setupUrl);
  }

  if (pathname.startsWith("/admin") && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

function isSetupSafePath(pathname: string) {
  return (
    pathname === "/setup" ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.match(/\.[a-zA-Z0-9]+$/)
  );
}

export const config = {
  matcher: ["/:path*"]
};
