import { CheckIcon } from "lucide-react";
import { ViewTransition } from "react";
import type { PlanCopy } from "@/components/site/dict";
import { SiteLink } from "@/components/site/site-link";
import { FEATURED_PLAN, type PlanId } from "@/lib/ui/site";
import { cn } from "@/lib/utils";

/** Same `name` on the pricing card and the signup summary, so the chosen plan morphs into checkout. */
export function PlanMorph({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={`plan-${id}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}

export function PlanCard({ id, plan, badge }: { id: PlanId; plan: PlanCopy; badge: string }) {
  const featured = id === FEATURED_PLAN;
  return (
    <PlanMorph id={id}>
      <article className={cn("relative flex flex-col border-[3px] border-ink p-6 lg:p-8", featured ? "bg-ink text-beige" : "bg-beige")}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="t-h3">{plan.name}</h2>
          {featured && <span className="bg-blue px-2 py-0.5 text-[11px] leading-4 font-medium text-white">{badge}</span>}
        </div>
        <p className={cn("t-small mt-2 min-h-10", featured ? "text-beige/75" : "text-ink/75")}>{plan.blurb}</p>
        <p className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-[40px] leading-none font-bold tracking-[-0.02em]">{plan.price}</span>
          <span className={cn("t-small", featured ? "text-beige/75" : "text-ink/70")}>{plan.cadence}</span>
        </p>
        <SiteLink href={`/signup/${id}`} className={cn("btn mt-6 w-full", featured ? "btn-primary" : "btn-secondary")}>
          {plan.cta}
        </SiteLink>
        <ul className={cn("mt-8 flex flex-col gap-3 border-t pt-6 t-small", featured ? "border-beige/30" : "border-ink/30")}>
          {plan.features.map((f) => (
            <li key={f} className="flex gap-3">
              <CheckIcon className={cn("mt-0.5 size-4 shrink-0", featured ? "text-beige" : "text-blue")} aria-hidden />
              {f}
            </li>
          ))}
        </ul>
        {id === "free" && <span aria-hidden className="absolute right-0 bottom-0 size-8 bg-blue" />}
      </article>
    </PlanMorph>
  );
}
