import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDict } from "@/components/site/dict";
import { PageTransition } from "@/components/site/page-transition";
import { SignupView } from "@/components/site/signup-view";
import { isPlanId, type Lang } from "@/lib/ui/site";

export function SignupFreeView({ lang }: { lang: Lang }) {
  return (
    <PageTransition>
      <SignupView id="free" t={getDict(lang)} />
    </PageTransition>
  );
}

export function SignupPlanView({ lang, params }: { lang: Lang; params: Promise<{ plan: string }> }) {
  return (
    <PageTransition>
      <Suspense>
        <PlanSignup lang={lang} params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function PlanSignup({ lang, params }: { lang: Lang; params: Promise<{ plan: string }> }) {
  const { plan } = await params;
  if (!isPlanId(plan)) notFound();
  return <SignupView id={plan} t={getDict(lang)} />;
}
