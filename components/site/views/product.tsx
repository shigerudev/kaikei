import { CtaButtons } from "@/components/site/cta-buttons";
import { LedgerFrame, LedgerHead, LedgerRow } from "@/components/site/ledger";
import { PageTransition } from "@/components/site/page-transition";
import { getDict } from "@/components/site/dict";
import { ProductShowcase } from "@/components/site/product-showcase";
import { Screen, type ScreenName } from "@/components/site/screen";
import type { Lang } from "@/lib/ui/site";

const SHOWCASE: ScreenName[] = ["uploads", "findings", "intercompany", "dashboard"];

export function ProductView({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const p = t.product;
  return (
    <PageTransition>
      <LedgerFrame>
        <LedgerHead n="01" title={p.title} lead={p.lead}>
          <div className="mt-8">
            <CtaButtons t={t.cta} />
          </div>
        </LedgerHead>

        <LedgerRow n="02" title={p.how.side} note={p.how.note}>
          <h2 className="t-h2 max-w-[40rem]">{p.howTitle}</h2>
          <ProductShowcase steps={t.showcase} views={SHOWCASE.map((name) => <Screen key={name} name={name} alt={t.screens[name]} crop />)} />
        </LedgerRow>

        <LedgerRow n="03" title={p.inspector.side} note={p.inspector.note}>
          <h2 className="t-h2">{p.inspectorTitle}</h2>
          <p className="t-lead mt-4 max-w-[44rem] text-ink/80">{p.inspectorLead}</p>
          <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <dl className="self-start border-t border-ink">
              {p.trail.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 border-b border-ink/40 py-2.5 t-small">
                  <dt className="font-semibold">{k}</dt>
                  <dd className="text-ink/80 [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
            <Screen name="inspector" alt={t.screens.inspector} crop />
          </div>
        </LedgerRow>

        <LedgerRow n="04" title={p.start.side} note={p.start.note}>
          <div className="max-w-[40rem]">
            <h2 className="t-h2">{p.startTitle}</h2>
            <p className="t-lead mt-4 text-ink/80">{p.startLead}</p>
            <div className="mt-8">
              <CtaButtons t={t.cta} primary="blue" />
            </div>
          </div>
        </LedgerRow>
      </LedgerFrame>
    </PageTransition>
  );
}
