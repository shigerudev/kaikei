import { OctagonXIcon, SendIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { PublishButton } from "@/components/runs/run-actions";
import type { Finding, Run } from "@/lib/api/types";
import { gPath } from "@/lib/ui/nav";

/**
 * Publication state, stated plainly (MANIFESTO §2 gates): a blocked draft lists its blockers; a clean run
 * offers Publish; a published run says it's frozen.
 */
export function RunBanner({ group, run, blockers }: { group: string; run: Run; blockers: Finding[] }) {
  if (run.status === "PUBLISHED")
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-subtle/50 px-4 py-3 text-sm">
        <ShieldCheckIcon className="size-4 shrink-0 text-brand" />
        <p className="flex-1">
          <span className="font-medium">Published.</span> <span className="text-muted-foreground">Run #{run.number} is frozen. Changes create a new run.</span>
        </p>
      </div>
    );
  if (blockers.length)
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-negative/25 bg-negative/[0.06] px-4 py-3 text-sm sm:flex-row sm:items-center">
        <OctagonXIcon className="hidden size-4 shrink-0 text-negative sm:block" />
        <p className="flex-1">
          <span className="font-medium">Draft — not publishable.</span>{" "}
          <span className="text-muted-foreground">
            {blockers.length} blocker{blockers.length === 1 ? "" : "s"} open:{" "}
            {blockers.map((b, i) => (
              <span key={b.id}>
                <Link href={gPath(group, `/findings/${b.id}`)} className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
                  {b.reference ?? b.rule_id}
                </Link>
                {i < blockers.length - 1 ? ", " : ""}
              </span>
            ))}
            . Figures below are a labelled preview of this draft.
          </span>
        </p>
        <PublishButton runId={run.id} blockers={blockers.length} published={false} />
      </div>
    );
  return (
    <div className="flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center">
      <SendIcon className="hidden size-4 shrink-0 text-brand sm:block" />
      <p className="flex-1">
        <span className="font-medium">Ready for review.</span> <span className="text-muted-foreground">No blockers open. Publishing freezes run #{run.number}.</span>
      </p>
      <PublishButton runId={run.id} blockers={0} published={false} />
    </div>
  );
}
