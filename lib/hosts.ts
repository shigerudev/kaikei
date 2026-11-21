/**
 * Where each surface lives in production: the marketing site on kaikei.io (Vercel) and the platform on
 * app.kaikei.io (self-hosted). Anywhere else (localhost, Vercel previews) both run on one host.
 */
export const SITE_ORIGIN = process.env.KAIKEI_SITE_ORIGIN ?? "https://kaikei.io";
export const APP_ORIGIN = process.env.KAIKEI_APP_ORIGIN ?? "https://app.kaikei.io";
export const COOKIE_DOMAIN = ".kaikei.io";

export type HostRole = "site" | "app" | "both";

export function hostRole(host: string | null | undefined): HostRole {
  const h = (host ?? "").split(":")[0]!.toLowerCase();
  if (h === new URL(APP_ORIGIN).hostname) return "app";
  if (h === new URL(SITE_ORIGIN).hostname || h === `www.${new URL(SITE_ORIGIN).hostname}`) return "site";
  return "both";
}

/** True when the session cookie must be shared across *.kaikei.io. */
export const sharesCookie = (host: string | null | undefined) => hostRole(host) !== "both";

/** A `next` target is safe if it's a local path or a URL on the platform origin. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return next.startsWith(`${APP_ORIGIN}/`) ? next : null;
}

/** Where to land after login/onboarding, given the host serving the request. */
export const appHomeFor = (host: string | null | undefined) => (hostRole(host) === "site" ? `${APP_ORIGIN}/app` : "/app");
