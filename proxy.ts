import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALES, preferredLocale } from "@/lib/i18n/config";

/**
 * Every page lives under /en, /sv or /de. A URL without a language ("/", "/products") is redirected to
 * the visitor's saved choice, else their browser language, else English.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;

  const locale = preferredLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next.js internals and files with an extension (favicon, images, …).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
