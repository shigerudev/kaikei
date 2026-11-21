"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use } from "react";
import { DEFAULT_LANG, type Lang, localize, SITE_ROUTES, stripLocale } from "@/lib/ui/site";

const LangContext = createContext<Lang>(DEFAULT_LANG);

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export const useLang = () => use(LangContext);

const rank = (path: string) => {
  const base = "/" + (stripLocale(path.split("?")[0]).split("/")[1] ?? "");
  const i = (SITE_ROUTES as readonly string[]).indexOf(base);
  return i === -1 ? SITE_ROUTES.length : i;
};

/** `next/link` for unlocalized public paths: adds the locale prefix and tags the navigation forward or back by route order. */
export function SiteLink({ href, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const lang = useLang();
  const pathname = usePathname();
  const from = rank(pathname);
  const to = rank(href);
  const types = to === from ? undefined : [to > from ? "nav-forward" : "nav-back"];
  return <Link href={localize(lang, href)} transitionTypes={types} {...props} />;
}
