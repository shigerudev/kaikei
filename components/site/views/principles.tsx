import { CtaButtons } from "@/components/site/cta-buttons";
import { LedgerFrame, LedgerHead, LedgerRow } from "@/components/site/ledger";
import { PageTransition } from "@/components/site/page-transition";
import { getDict } from "@/components/site/dict";
import type { Lang } from "@/lib/ui/site";

export function PrinciplesView({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const p = t.principles;
  return (
    <PageTransition>
      <LedgerFrame>
        <LedgerHead n="01" title={p.title} lead={p.lead} />

        <LedgerRow n="02" title={p.list.side} note={p.list.note}>
          <h2 className="t-h2">{t.home.principlesTitle}</h2>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
            {p.items.map((v, i) => (
              <div key={v.title} className="relative min-h-48 p-6 outline-1 -outline-offset-1 outline-ink">
                <h3 className="t-h3">{v.title}</h3>
                <p className="t-body mt-3 max-w-[28rem] text-ink/80">{v.body}</p>
                {i === 0 && <span aria-hidden className="absolute right-0 bottom-0 size-10 bg-blue" />}
              </div>
            ))}
          </div>
        </LedgerRow>

        <LedgerRow n="03" title={p.voice.side} note={p.voice.note}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <h2 className="t-h2">{p.voiceTitle}</h2>
              <p className="t-body mt-4 text-ink/80">{p.voiceBody}</p>
              <p className="t-sub mt-6">{p.quote}</p>
            </div>
            <table className="w-full border-collapse self-start text-left">
              <thead>
                <tr className="border-b border-ink">
                  <th className="py-2 pr-6 font-semibold">{p.say}</th>
                  <th className="py-2 font-semibold">{p.notSay}</th>
                </tr>
              </thead>
              <tbody>
                {p.table.map(([say, not]) => (
                  <tr key={say} className="border-b border-ink/40 align-top">
                    <td className="py-3 pr-6 font-medium">{say}</td>
                    <td className="py-3 text-ink/60">{not}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LedgerRow>

        <LedgerRow n="04" title={p.start.side} note={p.start.note}>
          <div className="max-w-[40rem]">
            <h2 className="t-h2">{p.startTitle}</h2>
            <div className="mt-8">
              <CtaButtons t={t.cta} primary="blue" />
            </div>
          </div>
        </LedgerRow>
      </LedgerFrame>
    </PageTransition>
  );
}
