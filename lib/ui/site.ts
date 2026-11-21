/**
 * Public site (kaikei.io): locales, routes and plans. Spanish is served unprefixed (proxy rewrites to
 * /es), English under /en. Plan prices are placeholders until pricing is decided.
 */
export const SITE = {
  name: "kaikei",
  url: "https://kaikei.io",
  version: "v0.2.0",
  /** Where a signed-in user lands. Only the sample group exists until the engine can create groups. */
  appHome: "/app",
  mcpUrl: "https://kaikei.io/api/mcp/",
} as const;

export const LOCALES = ["es", "en"] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = "es";
export const isLang = (v: string | undefined): v is Lang => LOCALES.includes(v as Lang);

/** Public routes in navigation order; slide direction follows this order. */
export const SITE_ROUTES = ["/", "/product", "/assistants", "/principles", "/pricing", "/signup", "/login", "/onboarding"] as const;
export const NAV_ROUTES = ["/product", "/assistants", "/principles", "/pricing"] as const;
export type NavRoute = (typeof NAV_ROUTES)[number];

export function stripLocale(pathname: string): string {
  const m = pathname.match(/^\/(es|en)(\/.*)?$/);
  return m ? m[2] || "/" : pathname;
}

export function localize(lang: Lang, path: string): string {
  if (lang === DEFAULT_LANG) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

export type PlanId = "free" | "group" | "holding";
export const PLAN_IDS: PlanId[] = ["free", "group", "holding"];
export const FEATURED_PLAN: PlanId = "group";
export const isPlanId = (v: string | undefined): v is PlanId => PLAN_IDS.includes(v as PlanId);
