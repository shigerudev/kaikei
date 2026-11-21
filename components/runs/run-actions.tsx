"use client";

import { CheckCircle2Icon, Loader2Icon, PlayIcon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { publishAction, startRunAction } from "@/app/g/[group]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortHash } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

/** Start a new run with a reason. The same inputs and versions reproduce the same fingerprint. */
export function StartRunButton({ group, defaultOpen = false, variant = "outline" }: { group: string; defaultOpen?: boolean; variant?: "outline" | "brand" }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [reason, setReason] = useState("Rerun with the same inputs");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          <PlayIcon /> Start run
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new run</DialogTitle>
          <DialogDescription>Pins the approved files, mapping, rate set and rule set. Earlier runs are kept unchanged.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="run-reason" className="text-xs text-muted-foreground">Reason</Label>
          <Input id="run-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            variant="brand"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await startRunAction(group, reason);
                if (!res.ok) {
                  toast.error("Couldn't start the run", { description: res.error });
                  return;
                }
                setOpen(false);
                toast.success(`Run #${res.data.number} finished`, { description: `Fingerprint ${shortHash(res.data.fingerprint)}` });
                router.push(gPath(group, `/runs/${res.data.id}`));
              })
            }
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <PlayIcon />} Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Publish freezes an approved snapshot. Disabled while any BLOCKER is open (the gate). */
export function PublishButton({ runId, blockers, published }: { runId: string; blockers: number; published: boolean }) {
  const [pending, start] = useTransition();
  if (published)
    return (
      <Button size="sm" variant="outline" disabled>
        <CheckCircle2Icon /> Published
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="brand"
      disabled={blockers > 0 || pending}
      title={blockers ? `${blockers} blocker(s) open` : undefined}
      onClick={() =>
        start(async () => {
          const res = await publishAction(runId);
          if (!res.ok) toast.error("Not published", { description: res.error });
          else toast.success(`Run #${res.data.number} published`, { description: "The snapshot is frozen." });
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Publish
    </Button>
  );
}
