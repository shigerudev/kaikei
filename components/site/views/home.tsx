import { Brand } from "@/components/site/brand";
import { CtaButtons } from "@/components/site/cta-buttons";
import { LedgerFrame, LedgerRow } from "@/components/site/ledger";
import { Transcript } from "@/components/site/mcp-section";
import { PageTransition } from "@/components/site/page-transition";
import { getDict } from "@/components/site/dict";
import { Screen } from "@/components/site/screen";
import { SetupCard } from "@/components/site/setup-card";
import { FEATURED_PLAN, type Lang, PLAN_IDS } from "@/lib/ui/site";
import { cn } from "@/lib/utils";

export function HomeView({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const h = t.home;
  return (
    <PageTransition>
      <LedgerFrame>
        <section className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_216px]">
          <aside className="hidden border-l-[3px] border-ink p-6 lg:order-2 lg:flex lg:flex-col lg:gap-6">
            <Brand kind="logo" width={168} height={168} className="h-auto w-full" />
            <p className="t-small font-semibold">{h.aside}</p>
          </aside>
          <div className="reveal min-w-0 px-5 py-12 md:px-8 lg:order-1 lg:px-12 lg:py-20">
            <h1 className="t-display max-w-[48rem]">{h.title}</h1>
            <p className="t-lead mt-6 max-w-[38rem] text-ink/80">{h.lead}</p>
            <div className="mt-8">
              <CtaButtons t={t.cta} />
            </div>
            <p className="t-small mt-4 text-ink/70">{t.cta.note}</p>
          </div>
        </section>
        <div className="reveal border-t-[3px] border-ink p-3 [animation-delay:120ms] md:p-5 lg:p-8">
          <Screen name="dashboard" alt={t.screens.dashboard} priority />
        </div>

        <LedgerRow n="02" title={h.how.side} note={h.how.note} more={{ href: "/product", label: h.how.more }}>
          <h2 className="t-h2 max-w-[40rem]">{h.howTitle}</h2>
          <p className="t-lead mt-4 max-w-[40rem] text-ink/80">{h.howLead}</p>
          <ol className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-px border-[3px] border-ink bg-ink sm:grid-cols-2 xl:grid-cols-4">
            {h.steps.map((s, i) => (
              <li key={s.title} className="flex min-h-44 flex-col bg-beige p-5">
                <span className="font-display text-xl font-medium tabular-nums text-ink/60">{`0${i + 1}`}</span>
                <p className="t-h3 mt-auto">{s.title}</p>
                <p className="t-small mt-2 text-ink/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </LedgerRow>

        <LedgerRow n="03" title={h.assistants.side} note={h.assistants.note} more={{ href: "/assistants", label: h.assistants.more }}>
          <h2 className="t-h2 max-w-[40rem]">{h.assistantsTitle}</h2>
          <p className="t-lead mt-4 max-w-[44rem] text-ink/80">{h.assistantsLead}</p>
          <div className="mt-10 grid max-w-[52rem] grid-cols-[minmax(0,1fr)] gap-8">
            <SetupCard t={t.setup} />
            <Transcript t={t.mcp} />
          </div>
        </LedgerRow>

        <LedgerRow n="04" title={h.principles.side} note={h.principles.note} more={{ href: "/principles", label: h.principles.more }}>
          <h2 className="t-h2">{h.principlesTitle}</h2>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
            {t.principles.items.map((v, i) => (
              <div key={v.title} className="relative min-h-48 p-6 outline-1 -outline-offset-1 outline-ink">
                <h3 className="t-h3">{v.title}</h3>
                <p className="t-body mt-3 max-w-[28rem] text-ink/80">{v.body}</p>
                {i === 0 && <span aria-hidden className="absolute right-0 bottom-0 size-10 bg-blue" />}
              </div>
            ))}
          </div>
        </LedgerRow>

        <LedgerRow n="05" title={h.pricing.side} note={h.pricing.note} more={{ href: "/pricing", label: h.pricing.more }}>
          <h2 className="t-h2">{h.pricingTitle}</h2>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-px border-[3px] border-ink bg-ink md:grid-cols-3">
            {PLAN_IDS.map((id) => {
              const p = t.pricing.plans[id];
              const featured = id === FEATURED_PLAN;
              return (
                <div key={id} className={cn("flex flex-col gap-2 p-5", featured ? "bg-ink text-beige" : "bg-beige")}>
                  <p className="t-sub">{p.name}</p>
                  <p className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold">{p.price}</span>
                    <span className={cn("t-small", featured ? "text-beige/70" : "text-ink/70")}>{p.cadence}</span>
                  </p>
                  <p className={cn("t-small", featured ? "text-beige/80" : "text-ink/80")}>{p.blurb}</p>
                </div>
              );
            })}
          </div>
          <p className="t-small mt-4 text-ink/75">{t.setup.free}</p>
        </LedgerRow>

        <LedgerRow n="06" title={h.start.side} note={h.start.note}>
          <div className="max-w-[40rem]">
            <h2 className="t-h2">{h.startTitle}</h2>
            <p className="t-lead mt-4 text-ink/80">{h.startLead}</p>
            <div className="mt-8">
              <CtaButtons t={t.cta} primary="blue" />
            </div>
          </div>
        </LedgerRow>
      </LedgerFrame>
    </PageTransition>
  );
}
