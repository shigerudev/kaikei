import { type NextRequest, NextResponse } from "next/server";

/**
 * Auth gate between the marketing site and the platform (same app, same `kaikei_session` cookie).
 * - /g/*   without a session → kaikei.io/login?next=<path> (relative /login outside production).
 * - /login with a session    → straight into the platform (or the safe `next` path).
 * TODO(Antonio): the cookie is a placeholder (unsigned); swap for Better Auth sessions (MANIFESTO roadmap).
 */
const COOKIE = "kaikei_session";
const APP_HOME = "/g/grupo-ag";
const PROD_LOGIN = "https://kaikei.io/login";

function hasSession(req: NextRequest) {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return false;
  try {
    const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    return typeof JSON.parse(json)?.email === "string";
  } catch {
    return false;
  }
}

const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v : null);

function loginUrl(req: NextRequest) {
  const configured = process.env.KAIKEI_LOGIN_URL;
  const onKaikei = req.nextUrl.hostname === "kaikei.io" || req.nextUrl.hostname === "www.kaikei.io";
  const base = configured ?? (onKaikei || process.env.VERCEL_ENV === "production" ? PROD_LOGIN : new URL("/login", req.url).toString());
  const url = new URL(base);
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return url;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = hasSession(req);

  if (pathname.startsWith("/g/") || pathname === "/g") {
    return authed ? NextResponse.next() : NextResponse.redirect(loginUrl(req));
  }

  // /login and /en/login: already signed in → into the platform.
  if (authed) {
    const next = safeNext(req.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next ?? APP_HOME, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/g/:path*", "/login", "/en/login"],
};
