import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, InfoIcon, LoaderIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import type { FindingStatus, MatchStatus, RunStatus, Severity } from "@/lib/api/types";

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

const RUN: Record<RunStatus, { label: string; cls: string; Icon: typeof CircleCheckIcon }> = {
  CREATED: { label: "Creada", cls: "bg-muted text-muted-foreground", Icon: CircleDashedIcon },
  RUNNING: { label: "En curso", cls: "bg-muted text-foreground", Icon: LoaderIcon },
  DRAFT: { label: "Borrador", cls: "bg-muted text-foreground", Icon: CircleDashedIcon },
  BLOCKED: { label: "Bloqueada", cls: "bg-negative/12 text-negative", Icon: OctagonXIcon },
  READY_FOR_REVIEW: { label: "Lista para revisión", cls: "bg-brand-subtle text-brand", Icon: CircleAlertIcon },
  PUBLISHED: { label: "Publicada", cls: "bg-brand text-brand-foreground", Icon: CircleCheckIcon },
  FAILED: { label: "Fallida", cls: "bg-negative/12 text-negative", Icon: OctagonXIcon },
};

/** Publication badge (MANIFESTO §3.2): a draft preview is always labelled as such. */
export function RunStatusBadge({ status, className = "" }: { status: RunStatus; className?: string }) {
  const { label, cls, Icon } = RUN[status];
  return (
    <span className={`${pill} ${cls} ${className}`}>
      <Icon className={`size-3 ${status === "RUNNING" ? "animate-spin" : ""}`} /> {label}
    </span>
  );
}

const SEV: Record<Severity, { cls: string; dot: string; Icon: typeof InfoIcon }> = {
  BLOCKER: { cls: "bg-negative/12 text-negative", dot: "bg-negative", Icon: OctagonXIcon },
  WARNING: { cls: "bg-warning/15 text-warning", dot: "bg-warning", Icon: TriangleAlertIcon },
  INFO: { cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", Icon: InfoIcon },
};

const SEV_LABEL: Record<Severity, string> = { BLOCKER: "Bloqueante", WARNING: "Advertencia", INFO: "Info" };

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { cls, Icon } = SEV[severity];
  return (
    <span className={`${pill} ${cls}`}>
      <Icon className="size-3" /> {SEV_LABEL[severity]}
    </span>
  );
}

export const severityDot = (s: Severity) => SEV[s].dot;

const FSTATUS: Record<FindingStatus, { label: string; cls: string }> = {
  OPEN: { label: "Abierto", cls: "text-foreground" },
  UNDER_REVIEW: { label: "En revisión", cls: "text-foreground" },
  RESOLVED: { label: "Resuelto", cls: "text-brand" },
  ACCEPTED_RISK: { label: "Riesgo aceptado", cls: "text-muted-foreground" },
  SUPERSEDED: { label: "Reemplazado", cls: "text-muted-foreground" },
};

export function FindingStatusText({ status }: { status: FindingStatus }) {
  const { label, cls } = FSTATUS[status];
  return <span className={`text-xs ${cls}`}>{label}</span>;
}

const MATCH: Record<MatchStatus, { label: string; cls: string }> = {
  MATCHED: { label: "Conciliado", cls: "bg-brand-subtle text-brand" },
  MISMATCH: { label: "Diferencia", cls: "bg-warning/15 text-warning" },
  ONE_SIDED: { label: "Sin contraparte", cls: "bg-warning/15 text-warning" },
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const { label, cls } = MATCH[status];
  return <span className={`${pill} ${cls}`}>{label}</span>;
}

/** Company chip: EMP code in mono, name optional. */
export function CompanyTag({ id, name }: { id: string; name?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="rounded bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground">{id}</span>
      {name && <span>{name}</span>}
    </span>
  );
}
