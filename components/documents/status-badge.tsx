import { CheckIcon, CircleDashedIcon, HelpCircleIcon } from "lucide-react";
import type { DocumentStatus } from "@/lib/data/types";

const MAP: Record<DocumentStatus, { label: string; cls: string; Icon: typeof CheckIcon }> = {
  matched: { label: "Linked", cls: "bg-brand-subtle text-brand", Icon: CheckIcon },
  needs_review: { label: "Suggested match", cls: "bg-muted text-foreground", Icon: CircleDashedIcon },
  uncertain: { label: "No match yet", cls: "bg-warning/15 text-warning", Icon: HelpCircleIcon },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${cls}`}>
      <Icon className="size-3" /> {label}
    </span>
  );
}
