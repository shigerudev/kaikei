import type { Dict } from "@/components/site/dict";

export const MCP_TOOLS = ["get_run_status", "get_facts", "get_findings", "get_reconciliations", "get_fact_lineage"];

const calls = [
  { name: "get_facts", args: "account: REVENUE, period: 2027-01", result: "USD, run #3" },
  { name: "get_fact_lineage", args: "fact: REVENUE 2027-01", result: "6 / 6" },
];

export function Transcript({ t }: { t: Dict["mcp"] }) {
  return (
    <div className="border-[3px] border-ink text-[15px] leading-6">
      <div className="flex items-baseline justify-between gap-4 border-b-[3px] border-ink px-4 py-3">
        <p className="font-display text-base font-medium">{t.client}</p>
        <p className="text-xs text-ink/70">{t.readOnly}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_34%]">
        <div className="min-w-0">
          <div className="border-b border-ink px-4 py-3">
            <p className="text-xs text-ink/70">{t.asked}</p>
            <p className="mt-1 font-medium">{t.question}</p>
          </div>
          {calls.map((c) => (
            <div key={c.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-ink/30 px-4 py-2 font-mono text-[12.5px]">
              <span className="truncate">
                <span className="font-medium">{c.name}</span> <span className="text-ink/70">{c.args}</span>
              </span>
              <span className="text-ink/70">{c.result}</span>
            </div>
          ))}
          <div className="px-4 py-3">
            <p className="text-xs text-ink/70">{t.answered}</p>
            <p className="mt-1">{t.answer}</p>
          </div>
        </div>
        <div className="flex flex-col border-t-[3px] border-ink md:border-t-0 md:border-l-[3px]">
          <div className="flex flex-col gap-2 px-4 py-3 text-[13px] [overflow-wrap:anywhere]">
            <p className="font-semibold">{t.source}</p>
            {t.sources.map((s) => (
              <p key={s} className="text-ink/80">
                {s}
              </p>
            ))}
          </div>
          <div className="mt-auto border-t-[3px] border-ink bg-blue px-4 py-3 text-white">
            <p className="text-xs">run</p>
            <p className="font-medium">{t.run}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
