import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/constants";
import { getUrlLocaleFromPathname, localeToUrlLocale, urlLocaleToLocale } from "@/lib/locale-url";

const legacyPublicPrefixes = [
  "/articles",
  "/tags",
  "/archives",
  "/moments",
  "/guestbook",
  "/contact"
];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (process.env.SETUP_REQUIRED === "true" && !isSetupSafePath(pathname)) {
    if (await isInstallationComplete(request)) {
      return NextResponse.next();
    }

    const setupUrl = new URL("/setup", request.url);
    setupUrl.searchParams.set("reason", "migration");
    return NextResponse.redirect(setupUrl);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    const appLocale = resolvePreferredAppLocale(request);
    url.pathname = `/${localeToUrlLocale(appLocale)}`;
    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE_NAME, appLocale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365
    });
    return response;
  }

  if (isLegacyPublicPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (pathname.startsWith("/admin") && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  const urlLocale = getUrlLocaleFromPathname(pathname);
  const appLocale = urlLocale ? urlLocaleToLocale(urlLocale) : null;
  if (urlLocale && appLocale) {
    requestHeaders.set("x-liax-url-locale", urlLocale);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  if (appLocale) {
    response.cookies.set(LOCALE_COOKIE_NAME, appLocale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  return response;
}

function resolvePreferredAppLocale(request: NextRequest) {
  const saved = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (saved === "en" || saved === "zh-CN") {
    return saved;
  }

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().includes("zh") ? "zh-CN" : "en";
}

function isLegacyPublicPath(pathname: string) {
  return legacyPublicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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

async function isInstallationComplete(request: NextRequest) {
  try {
    const response = await fetch(new URL("/api/setup", request.url), {
      cache: "no-store"
    });

    if (!response.ok) {
      return false;
    }

    const status = (await response.json()) as { completed?: boolean; hasOwner?: boolean };
    return Boolean(status.completed || status.hasOwner);
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/:path*"]
};
