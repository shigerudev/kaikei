import { CheckIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { readSession } from "@/app/(marketing)/session";
import { OnboardingForm } from "@/components/site/auth-forms";
import { AuthShell } from "@/components/site/auth-shell";
import { type Dict, getDict } from "@/components/site/dict";
import { PageTransition } from "@/components/site/page-transition";
import { type Lang, localize } from "@/lib/ui/site";
import { cn } from "@/lib/utils";

export function OnboardingView({ lang }: { lang: Lang }) {
  const t = getDict(lang).auth;
  return (
    <PageTransition>
      <Suspense fallback={<Onboarding name="" t={t} />}>
        <OnboardingForSession lang={lang} t={t} />
      </Suspense>
    </PageTransition>
  );
}

async function OnboardingForSession({ lang, t }: { lang: Lang; t: Dict["auth"] }) {
  const session = await readSession();
  if (!session) redirect(localize(lang, "/signup"));
  return <Onboarding name={session.name.split(" ")[0] ?? ""} t={t} />;
}

function Onboarding({ name, t }: { name: string; t: Dict["auth"] }) {
  return (
    <AuthShell
      title={name ? t.welcome.replace("{name}", name) : t.nameGroup}
      lead={t.onboardingLead}
      aside={
        <div className="flex flex-col gap-6">
          <ol className="border-[3px] border-ink">
            {t.progress.map((label, i) => (
              <li key={label} className={cn("flex items-center justify-between border-b border-ink px-4 py-3 last:border-b-0", i === 1 && "bg-blue text-white")}>
                <span className="flex items-center gap-3 font-medium">
                  <span className="font-display tabular-nums">{`0${i + 1}`}</span>
                  {label}
                </span>
                {i === 0 && <CheckIcon className="size-4" aria-label={t.done} />}
              </li>
            ))}
          </ol>
          <p className="t-body text-ink/80">{t.onboardingAside}</p>
        </div>
      }
    >
      <OnboardingForm t={t} />
    </AuthShell>
  );
}
