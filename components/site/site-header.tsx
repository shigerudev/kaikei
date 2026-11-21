"use client";

import { MenuIcon, MoonIcon, SunIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { LogInForm } from "@/components/site/auth-forms";
import { Brand } from "@/components/site/brand";
import type { Dict } from "@/components/site/dict";
import { SiteLink, useLang } from "@/components/site/site-link";
import { LOCALES, localize, NAV_ROUTES, stripLocale } from "@/lib/ui/site";
import { cn } from "@/lib/utils";

export function SiteHeader({ t, auth }: { t: Dict["nav"]; auth: Dict["auth"] }) {
  const lang = useLang();
  const pathname = usePathname();
  const path = stripLocale(pathname);
  const { resolvedTheme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);

  return (
    <header
      style={{ viewTransitionName: "site-header" }}
      className={cn(
        "sticky top-0 z-50 bg-beige/90 backdrop-blur-md transition-[box-shadow] duration-200",
        scrolled || open ? "shadow-[inset_0_-1px_0_var(--ink)]" : "shadow-[inset_0_-1px_0_transparent]",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1296px] items-center justify-between gap-6 px-5 md:h-20 md:px-8 lg:px-12">
        <SiteLink href="/" aria-label={t.home} className="shrink-0">
          <Brand kind="wordmark" alt="kaikei" width={113} height={30} className="h-[26px] w-auto md:h-[30px]" />
        </SiteLink>

        <nav aria-label="Main" className="flex items-center gap-7 max-lg:hidden">
          {NAV_ROUTES.map((href) => (
            <SiteLink
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "relative py-2 font-medium whitespace-nowrap transition-colors duration-150 hover:text-ink",
                "after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:origin-left after:bg-blue after:transition-transform after:duration-300 after:ease-[var(--ease-out)]",
                isActive(href) ? "text-ink after:scale-x-100" : "text-ink/70 after:scale-x-0",
              )}
            >
              {t.links[href]}
            </SiteLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 md:gap-2">
          <div role="group" aria-label={t.language} className="flex h-10 items-center text-[13px] font-semibold max-sm:hidden">
            {LOCALES.map((l) => (
              <Link
                key={l}
                href={localize(l, path)}
                hrefLang={l}
                lang={l}
                aria-current={l === lang ? "true" : undefined}
                transitionTypes={["lang-fade"]}
                className={cn("grid h-8 w-8 place-items-center uppercase transition-colors", l === lang ? "bg-ink text-beige" : "text-ink/60 hover:text-ink")}
              >
                {l}
              </Link>
            ))}
          </div>
          <button
            type="button"
            aria-label={t.theme}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="btn size-10 p-0 hover:bg-ink/10"
          >
            <SunIcon className="size-[18px] dark:hidden" aria-hidden />
            <MoonIcon className="hidden size-[18px] dark:block" aria-hidden />
          </button>

          <div className="group relative max-sm:hidden">
            <SiteLink href="/login" className={cn("btn h-10 px-3 text-[15px] whitespace-nowrap hover:bg-ink/10", path === "/login" && "bg-ink/10")}>
              {t.login}
            </SiteLink>
            {path !== "/login" && (
              <div
                className={cn(
                  "absolute top-full right-0 w-[22rem] pt-3",
                  "invisible translate-y-1 opacity-0 transition-[opacity,translate,visibility] duration-200 ease-[var(--ease-out)]",
                  "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-100",
                  "group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
                )}
              >
                <div className="border-[3px] border-ink bg-beige p-5 shadow-[6px_6px_0_var(--ink)]">
                  <p className="t-h3">{t.loginTitle}</p>
                  <div className="mt-4">
                    <LogInForm t={auth} compact />
                  </div>
                  <p className="t-small mt-4 text-ink/75">
                    {t.noAccount}{" "}
                    <SiteLink href="/signup" className="font-semibold text-ink underline underline-offset-4">
                      {t.signup}
                    </SiteLink>
                  </p>
                </div>
              </div>
            )}
          </div>

          <SiteLink href="/signup" className="btn btn-ink h-10 px-4 text-[15px] whitespace-nowrap">
            <span className="max-sm:hidden">{t.signup}</span>
            <span className="sm:hidden">{t.signupShort}</span>
          </SiteLink>
          <button
            type="button"
            aria-label={open ? t.closeMenu : t.openMenu}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpenOn(open ? null : pathname)}
            className="btn size-10 p-0 hover:bg-ink/10 lg:hidden"
          >
            {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>
      </div>

      <nav id="site-menu" aria-label="Main" hidden={!open} className="border-t border-ink px-5 pb-4 md:px-8 lg:hidden">
        {[...NAV_ROUTES.map((href) => ({ href, label: t.links[href] })), { href: "/login", label: t.login }].map((l) => (
          <SiteLink
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className="flex items-center justify-between border-b border-ink/30 py-3 font-medium"
          >
            {l.label}
            {isActive(l.href) && <span aria-hidden className="size-2.5 bg-blue" />}
          </SiteLink>
        ))}
        <div className="flex gap-2 pt-4">
          {LOCALES.map((l) => (
            <Link
              key={l}
              href={localize(l, path)}
              hrefLang={l}
              transitionTypes={["lang-fade"]}
              className={cn("btn h-9 px-3 text-[13px] uppercase", l === lang ? "btn-ink" : "btn-secondary")}
            >
              {l}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
