import { Brand } from "@/components/site/brand";
import type { Dict } from "@/components/site/dict";
import { SiteLink } from "@/components/site/site-link";
import { NAV_ROUTES, SITE } from "@/lib/ui/site";

export function SiteFooter({ t, tagline }: { t: Dict["nav"]; tagline: string }) {
  return (
    <footer className="mx-auto w-full max-w-[1296px] px-5 py-12 md:px-8 lg:px-12">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <Brand kind="wordmark" alt="kaikei" width={90} height={24} className="h-6 w-auto self-start" />
          <p className="t-small text-ink/75">{tagline}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 t-small">
          {NAV_ROUTES.map((href) => (
            <SiteLink key={href} href={href} className="text-ink/75 hover:text-ink">
              {t.links[href]}
            </SiteLink>
          ))}
          <SiteLink href="/login" className="text-ink/75 hover:text-ink">
            {t.login}
          </SiteLink>
          <span className="text-ink/50">
            kaikei.io <span className="px-1 text-ink/30">/</span> {SITE.version}
          </span>
        </nav>
      </div>
    </footer>
  );
}
