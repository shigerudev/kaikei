import { LedgerFrame } from "@/components/site/ledger";

/** Two-panel frame for the account screens: form on the left, context on the right. */
export function AuthShell({ title, lead, aside, children }: { title: string; lead?: React.ReactNode; aside: React.ReactNode; children: React.ReactNode }) {
  return (
    <LedgerFrame className="my-2 md:my-6">
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="reveal flex min-w-0 flex-col px-5 py-10 md:px-8 lg:px-12 lg:py-16">
          <div className="w-full max-w-[28rem]">
            <h1 className="t-h2">{title}</h1>
            {lead && <div className="t-body mt-3 text-ink/80">{lead}</div>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <aside className="flex min-w-0 flex-col border-t-[3px] border-ink p-5 md:p-8 lg:border-t-0 lg:border-l-[3px] lg:p-12">{aside}</aside>
      </div>
    </LedgerFrame>
  );
}
