import { CtaButtons } from "@/components/site/cta-buttons";
import { LedgerFrame, LedgerHead, LedgerRow } from "@/components/site/ledger";
import { MCP_TOOLS, Transcript } from "@/components/site/mcp-section";
import { PageTransition } from "@/components/site/page-transition";
import { getDict } from "@/components/site/dict";
import { SetupCard } from "@/components/site/setup-card";
import type { Lang } from "@/lib/ui/site";

export function AssistantsView({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const m = t.mcp;
  return (
    <PageTransition>
      <LedgerFrame>
        <LedgerHead n="01" title={m.pageTitle} lead={m.pageLead} />

        <LedgerRow n="02" title={m.setupSide.side} note={m.setupSide.note}>
          <div className="max-w-[48rem]">
            <SetupCard t={t.setup} />
          </div>
        </LedgerRow>

        <LedgerRow n="03" title={m.practice.side} note={m.practice.note}>
          <Transcript t={m} />
        </LedgerRow>

        <LedgerRow n="04" title={m.tools.side} note={m.tools.note}>
          <h2 className="t-h2">{m.toolsTitle}</h2>
          <p className="t-lead mt-4 max-w-[40rem] text-ink/80">{m.toolsBody}</p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {MCP_TOOLS.map((tool) => (
              <li key={tool} className="px-2.5 py-1 font-mono text-[13px] outline-1 -outline-offset-1 outline-ink">
                {tool}
              </li>
            ))}
          </ul>
        </LedgerRow>

        <LedgerRow n="05" title={m.bounds.side} note={m.bounds.note}>
          <h2 className="t-h2">{m.boundsTitle}</h2>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-3">
            {m.rules.map((r) => (
              <div key={r.title} className="p-6 outline-1 -outline-offset-1 outline-ink">
                <h3 className="t-h3">{r.title}</h3>
                <p className="t-body mt-3 text-ink/80">{r.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <CtaButtons t={t.cta} />
          </div>
        </LedgerRow>
      </LedgerFrame>
    </PageTransition>
  );
}
