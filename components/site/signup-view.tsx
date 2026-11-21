import { CheckIcon } from "lucide-react";
import { AuthShell } from "@/components/site/auth-shell";
import { SignUpForm } from "@/components/site/auth-forms";
import type { Dict } from "@/components/site/dict";
import { PlanMorph } from "@/components/site/plan-card";
import { SiteLink } from "@/components/site/site-link";
import { FEATURED_PLAN, type PlanId } from "@/lib/ui/site";
import { cn } from "@/lib/utils";

export function SignupView({ id, t }: { id: PlanId; t: Dict }) {
  const plan = t.pricing.plans[id];
  const a = t.auth;
  const featured = id === FEATURED_PLAN;
  return (
    <AuthShell
      title={id === "free" ? a.signupTitleFree : a.signupTitlePlan.replace("{plan}", plan.name)}
      lead={
        <>
          {a.haveAccount}{" "}
          <SiteLink href="/login" className="font-semibold underline underline-offset-4">
            {a.logIn}
          </SiteLink>
        </>
      }
      aside={
        <div className="flex h-full flex-col gap-4">
          <PlanMorph id={id}>
            <div className={cn("flex flex-col border-[3px] border-ink p-6", featured ? "bg-ink text-beige" : "bg-beige")}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="t-h3">{plan.name}</p>
                <p className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold">{plan.price}</span>
                  <span className={cn("t-small", featured ? "text-beige/70" : "text-ink/70")}>{plan.cadence}</span>
                </p>
              </div>
              <ul className={cn("mt-5 flex flex-col gap-2.5 border-t pt-5 t-small", featured ? "border-beige/30" : "border-ink/30")}>
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <CheckIcon className={cn("mt-0.5 size-4 shrink-0", featured ? "text-beige" : "text-blue")} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </PlanMorph>
          <SiteLink href="/pricing" className="t-small font-semibold underline underline-offset-4">
            {a.changePlan}
          </SiteLink>
          <p className="t-small mt-auto pt-6 text-ink/70">{id === "free" ? a.noCard : a.notCharged}</p>
        </div>
      }
    >
      <SignUpForm plan={id} t={a} />
    </AuthShell>
  );
}
