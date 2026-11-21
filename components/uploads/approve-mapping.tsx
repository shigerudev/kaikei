"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { approveMappingAction } from "@/app/g/[group]/actions";
import { Button } from "@/components/ui/button";

/** Review point: the reviewer freezes the company's mapping version before it can feed a run. */
export function ApproveMapping({ group, companyId, approved, disabled }: { group: string; companyId: string; approved: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  if (approved)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-2.5 py-1 text-xs font-medium text-brand">
        <CheckIcon className="size-3.5" /> Mapping approved · MAP-V1
      </span>
    );
  return (
    <Button
      size="sm"
      variant="brand"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const res = await approveMappingAction(group, companyId);
          if (!res.ok) toast.error("Not approved", { description: res.error });
          else toast.success(`${companyId} mapping approved`);
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Approve mapping
    </Button>
  );
}
