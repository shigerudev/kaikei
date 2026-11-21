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
  const [reason, setReason] = useState("Reejecutar con las mismas entradas");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          <PlayIcon /> Nueva ejecución
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva ejecución</DialogTitle>
          <DialogDescription>Fija los archivos aprobados, el mapeo, las tasas y las reglas. Las ejecuciones anteriores no cambian.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="run-reason" className="text-xs text-muted-foreground">Motivo</Label>
          <Input id="run-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancelar</Button>
          </DialogClose>
          <Button
            size="sm"
            variant="brand"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await startRunAction(group, reason);
                if (!res.ok) {
                  toast.error("No se pudo ejecutar", { description: res.error });
                  return;
                }
                setOpen(false);
                toast.success(`Ejecución #${res.data.number} lista`, { description: `Huella ${shortHash(res.data.fingerprint)}` });
                router.push(gPath(group, `/runs/${res.data.id}`));
              })
            }
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <PlayIcon />} Ejecutar
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
        <CheckCircle2Icon /> Publicada
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="brand"
      disabled={blockers > 0 || pending}
      title={blockers ? `${blockers} bloqueante(s) abierto(s)` : undefined}
      onClick={() =>
        start(async () => {
          const res = await publishAction(runId);
          if (!res.ok) toast.error("No se publicó", { description: res.error });
          else toast.success(`Ejecución #${res.data.number} publicada`, { description: "La versión quedó congelada." });
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Publicar
    </Button>
  );
}
