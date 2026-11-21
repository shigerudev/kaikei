import { type NextRequest, NextResponse } from "next/server";
import { APP_ORIGIN, hostRole, safeNext, SITE_ORIGIN } from "@/lib/hosts";

/**
 * Routing + auth gate between the marketing site and the platform, sharing the `kaikei_session` cookie.
 *
 * app.kaikei.io  → the platform with clean URLs: /uploads, /findings/FIND-E02, … are served from
 *                  /g/<workspace>/… internally. Old /g/<ws>/… links redirect to the clean form.
 *                  Marketing paths go back to kaikei.io; no session → kaikei.io/login?next=<url>.
 * kaikei.io      → marketing; /app and /g/<ws>/… redirect to the clean app.kaikei.io URL.
 * other hosts    → both on one host (localhost, previews), platform under /g/<ws>.
 * TODO(Antonio): the cookie is a placeholder (unsigned); swap for Better Auth sessions.
 */
const COOKIE = "kaikei_session";
const WORKSPACE_COOKIE = "kaikei_workspace";
const DEFAULT_WORKSPACE = process.env.KAIKEI_DEFAULT_GROUP ?? "demo";
/** First path segments that belong to the platform on app.kaikei.io. */
const PLATFORM = new Set(["", "uploads", "runs", "findings", "intercompany", "inspector", "settings", "search"]);

function hasSession(req: NextRequest) {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return false;
  try {
    return typeof JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/")))?.email === "string";
  } catch {
    return false;
  }
}

/** "/g/demo/uploads" → "/uploads"; "/g/demo" → "/". */
const stripWorkspace = (p: string) => p.replace(/^\/g\/[^/]+/, "") || "/";
const isPlatformPath = (p: string) => p === "/app" || p === "/g" || p.startsWith("/g/");
const isLogin = (p: string) => p === "/login" || p === "/en/login";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const role = hostRole(req.headers.get("host"));
  const authed = hasSession(req);

  if (role === "site") {
    if (pathname === "/app") return NextResponse.redirect(new URL(`/${search}`, APP_ORIGIN));
    if (pathname === "/g" || pathname.startsWith("/g/")) return NextResponse.redirect(new URL(stripWorkspace(pathname) + search, APP_ORIGIN));
    if (isLogin(pathname) && authed) return NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")) ?? `${APP_ORIGIN}/`));
    return NextResponse.next();
  }

  if (role === "app") {
    if (pathname === "/app") return NextResponse.redirect(new URL(`/${search}`, APP_ORIGIN));
    if (pathname === "/g" || pathname.startsWith("/g/")) {
      // Old links and fetches → canonical clean URL (keeps method/body for POSTs).
      return NextResponse.redirect(new URL(stripWorkspace(pathname) + search, APP_ORIGIN), 308);
    }
    const first = pathname.split("/")[1] ?? "";
    if (!PLATFORM.has(first)) return NextResponse.redirect(new URL(pathname + search, SITE_ORIGIN));
    if (!authed) {
      const login = new URL("/login", SITE_ORIGIN);
      login.searchParams.set("next", `${APP_ORIGIN}${pathname}${search}`);
      return NextResponse.redirect(login);
    }
    const ws = req.cookies.get(WORKSPACE_COOKIE)?.value || DEFAULT_WORKSPACE;
    const url = req.nextUrl.clone();
    url.pathname = `/g/${ws}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Single host: platform under /g/<ws>.
  if (isPlatformPath(pathname) && !authed) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  if (isLogin(pathname) && authed) {
    return NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")) ?? "/app", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: skip Next internals, API routes and files with an extension (icons, images, fonts).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
