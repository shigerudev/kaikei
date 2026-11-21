import { type NextRequest, NextResponse } from "next/server";
import { APP_ORIGIN, appHomeFor, hostRole, safeNext, SITE_ORIGIN } from "@/lib/hosts";

/**
 * Routing + auth gate between the marketing site and the platform, sharing the `kaikei_session` cookie.
 * - kaikei.io      → marketing; platform paths (/app, /g/*) redirect to app.kaikei.io.
 * - app.kaikei.io  → platform; "/" opens /app, marketing paths go back to kaikei.io,
 *                    no session → kaikei.io/login?next=<platform URL>.
 * - other hosts (localhost, previews) → both on one host, gate on /app and /g/*.
 * TODO(Antonio): the cookie is a placeholder (unsigned); swap for Better Auth sessions.
 */
const COOKIE = "kaikei_session";

function hasSession(req: NextRequest) {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return false;
  try {
    return typeof JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/")))?.email === "string";
  } catch {
    return false;
  }
}

const isPlatform = (p: string) => p === "/app" || p === "/g" || p.startsWith("/g/");
const isLogin = (p: string) => p === "/login" || p === "/en/login";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const role = hostRole(req.headers.get("host"));
  const authed = hasSession(req);

  if (role === "site" && isPlatform(pathname)) {
    return NextResponse.redirect(new URL(pathname + search, APP_ORIGIN));
  }

  if (role === "app" && !isPlatform(pathname)) {
    if (pathname === "/") return NextResponse.redirect(new URL("/app", APP_ORIGIN));
    return NextResponse.redirect(new URL(pathname + search, SITE_ORIGIN));
  }

  if (isPlatform(pathname) && !authed) {
    const login = role === "both" ? new URL("/login", req.url) : new URL("/login", SITE_ORIGIN);
    login.searchParams.set("next", role === "both" ? pathname + search : `${APP_ORIGIN}${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (isLogin(pathname) && authed) {
    const next = safeNext(req.nextUrl.searchParams.get("next")) ?? appHomeFor(req.headers.get("host"));
    return NextResponse.redirect(new URL(next, req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Pages only: skip Next internals, API routes and files with an extension (icons, images, fonts).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
