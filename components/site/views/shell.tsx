import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getDict } from "@/components/site/dict";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { LangProvider } from "@/components/site/site-link";
import { type Lang, SITE } from "@/lib/ui/site";

const excon = localFont({
  variable: "--font-excon",
  src: [
    { path: "../../../app/fonts/Excon-500.woff2", weight: "500", style: "normal" },
    { path: "../../../app/fonts/Excon-700.woff2", weight: "700", style: "normal" },
  ],
});

const synonym = localFont({
  variable: "--font-synonym",
  src: [
    { path: "../../../app/fonts/Synonym-400.woff2", weight: "400", style: "normal" },
    { path: "../../../app/fonts/Synonym-500.woff2", weight: "500", style: "normal" },
    { path: "../../../app/fonts/Synonym-600.woff2", weight: "600", style: "normal" },
  ],
});

export function siteMetadata(lang: Lang): Metadata {
  const { title, description } = getDict(lang).meta;
  return {
    metadataBase: new URL(SITE.url),
    title: { absolute: title, template: "%s · kaikei" },
    description,
    openGraph: { title, description, url: SITE.url, siteName: "kaikei", type: "website", locale: lang === "es" ? "es_ES" : "en_US" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const siteViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#dcd1c2" },
    { media: "(prefers-color-scheme: dark)", color: "#161b1a" },
  ],
};

/** Public site chrome for one locale. Spanish lives at the root, English under /en. */
export function SiteShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const t = getDict(lang);
  return (
    <LangProvider lang={lang}>
      <div lang={lang} className={`site ${excon.variable} ${synonym.variable} flex min-h-dvh flex-col antialiased`}>
        <SiteHeader t={t.nav} auth={t.auth} />
        <main className="mx-auto flex w-full max-w-[1296px] flex-1 flex-col px-5 md:px-8 lg:px-12">{children}</main>
        <SiteFooter t={t.nav} tagline={t.footer.tagline} />
      </div>
    </LangProvider>
  );
}
