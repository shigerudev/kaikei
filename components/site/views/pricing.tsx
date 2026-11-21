import { LedgerFrame, LedgerHead, LedgerRow } from "@/components/site/ledger";
import { PageTransition } from "@/components/site/page-transition";
import { getDict } from "@/components/site/dict";
import { PlanCard } from "@/components/site/plan-card";
import { type Lang, PLAN_IDS } from "@/lib/ui/site";

export function PricingView({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const p = t.pricing;
  return (
    <PageTransition>
      <LedgerFrame>
        <LedgerHead n="01" title={p.title} lead={p.lead} />
        <section className="grid grid-cols-[minmax(0,1fr)] gap-6 px-5 py-12 md:px-8 lg:grid-cols-3 lg:px-12 lg:py-16">
          {PLAN_IDS.map((id) => (
            <PlanCard key={id} id={id} plan={p.plans[id]} badge={p.featured} />
          ))}
        </section>
        <LedgerRow n="02" title={p.faqSide.side} note={p.faqSide.note}>
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-12 md:grid-cols-2">
            {p.faq.map(([q, a]) => (
              <div key={q} className="border-t border-ink py-6">
                <dt className="t-sub">{q}</dt>
                <dd className="t-body mt-2 text-ink/80">{a}</dd>
              </div>
            ))}
          </dl>
        </LedgerRow>
      </LedgerFrame>
    </PageTransition>
  );
}
