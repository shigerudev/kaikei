import { Suspense } from "react";
import { LogInForm } from "@/components/site/auth-forms";
import { AuthShell } from "@/components/site/auth-shell";
import { Brand } from "@/components/site/brand";
import { type Dict, getDict } from "@/components/site/dict";
import { PageTransition } from "@/components/site/page-transition";
import { SiteLink } from "@/components/site/site-link";
import type { Lang } from "@/lib/ui/site";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function LoginView({ lang, searchParams }: { lang: Lang; searchParams: SearchParams }) {
  const t = getDict(lang);
  const a = t.auth;
  return (
    <PageTransition>
      <AuthShell
        title={a.loginTitle}
        lead={
          <>
            {a.newHere}{" "}
            <SiteLink href="/signup" className="font-semibold underline underline-offset-4">
              {t.cta.primary}
            </SiteLink>
          </>
        }
        aside={
          <div className="flex h-full flex-col gap-6">
            <Brand kind="logo" width={120} height={120} className="h-auto w-24" />
            <p className="t-h3">{a.loginAsideTitle}</p>
            <p className="t-body text-ink/80">{a.loginAsideBody}</p>
            <p className="t-small mt-auto text-ink/70">{a.loginAsideFoot}</p>
          </div>
        }
      >
        <Suspense fallback={<LogInForm t={a} />}>
          <LogInWithNext searchParams={searchParams} t={a} />
        </Suspense>
      </AuthShell>
    </PageTransition>
  );
}

async function LogInWithNext({ searchParams, t }: { searchParams: SearchParams; t: Dict["auth"] }) {
  const next = (await searchParams).next;
  return <LogInForm t={t} next={typeof next === "string" ? next : undefined} />;
}
