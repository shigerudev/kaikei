"use client";

import { CheckIcon, Loader2Icon, RotateCcwIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { decideAction } from "@/app/g/[group]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Finding } from "@/lib/api/types";
import { formatStamp } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

/**
 * Resolve or accept a finding with a reason. Every decision is recorded and produces a NEW run;
 * the run that raised the finding is never modified (MANIFESTO §2 Reruns).
 */
export function DecisionPanel({ group, finding }: { group: string; finding: Finding }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const open = finding.status === "OPEN" || finding.status === "UNDER_REVIEW";

  const decide = (action: "RESOLVE" | "ACCEPT_RISK" | "REOPEN") =>
    start(async () => {
      const res = await decideAction(finding.id, action, action === "REOPEN" ? reason || "Reabierto para revisión" : reason);
      if (!res.ok) {
        toast.error("No se guardó la decisión", { description: res.error });
        return;
      }
      setReason("");
      toast.success(action === "RESOLVE" ? "Marcado como resuelto" : action === "ACCEPT_RISK" ? "Riesgo aceptado" : "Reabierto", {
        description: `Nueva ejecución #${res.data.number} · quedan ${res.data.counts.blockers_open} bloqueante(s)`,
      });
    });

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="text-sm font-medium">Decisión</h3>
      {open ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${finding.id}`} className="text-xs text-muted-foreground">
              Motivo (queda registrado con tu decisión)
            </Label>
            <Textarea
              id={`reason-${finding.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={finding.severity === "BLOCKER" ? "p. ej. La empresa subió el archivo corregido" : "p. ej. Confirmado con el contralor de la empresa"}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="brand" disabled={pending || !reason.trim()} onClick={() => decide("RESOLVE")}>
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Resolver
            </Button>
            <Button size="sm" variant="outline" disabled={pending || !reason.trim()} onClick={() => decide("ACCEPT_RISK")}>
              <ShieldAlertIcon /> Aceptar riesgo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cualquier opción crea una nueva ejecución. {finding.severity === "BLOCKER" ? "La publicación sigue bloqueada hasta resolver o aceptar cada bloqueante." : "Las advertencias no bloquean la publicación."}
          </p>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Este hallazgo ya tiene una decisión.</p>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("REOPEN")}>
            <RotateCcwIcon /> Reabrir
          </Button>
        </div>
      )}
      {finding.decisions && finding.decisions.length > 0 && (
        <ol className="space-y-2 border-t pt-3">
          {[...finding.decisions].reverse().map((d, i) => (
            <li key={i} className="text-xs">
              <span className="font-medium">{d.action === "RESOLVE" ? "Resuelto" : d.action === "ACCEPT_RISK" ? "Riesgo aceptado" : "Reabierto"}</span>
              <span className="text-muted-foreground">
                {" "}
                por {d.actor} · {formatStamp(d.at)} ·{" "}
                <Link href={gPath(group, `/runs/${d.resulting_run_id}`)} className="underline underline-offset-2">
                  {d.resulting_run_id}
                </Link>
              </span>
              <p className="mt-0.5 text-muted-foreground">“{d.reason}”</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
