"use client";

import { AlertTriangleIcon, ArrowLeftIcon, CheckCircle2Icon, CheckIcon, FileSpreadsheetIcon, Loader2Icon, SparklesIcon, UploadCloudIcon, WandSparklesIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { applyImportAction, proposeImportAction } from "@/app/w/[ws]/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApplyResult, ImportPreview } from "@/lib/data/types";
import type { MappingField, MappingProposal } from "@/lib/types";
import { formatPeriod, pluralize } from "@/lib/format";
import { formatMinor } from "@/lib/money";
import { wsPath } from "@/lib/nav";

type Step = "file" | "type" | "mapping" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "file", label: "File" },
  { key: "type", label: "Type" },
  { key: "mapping", label: "Columns" },
  { key: "done", label: "Summary" },
];

const FIELDS: Record<"actual" | "budget", { field: MappingField; label: string; required: boolean }[]> = {
  actual: [
    { field: "date", label: "Date", required: true },
    { field: "amount", label: "Amount", required: true },
    { field: "category", label: "Category", required: true },
    { field: "description", label: "Description", required: false },
    { field: "currency", label: "Currency", required: false },
    { field: "counterparty", label: "Counterparty", required: false },
  ],
  budget: [
    { field: "period", label: "Period", required: true },
    { field: "category", label: "Category", required: true },
    { field: "amount", label: "Amount", required: true },
    { field: "currency", label: "Currency", required: false },
  ],
};

const NONE = "__none__";

/**
 * Screen 3: import wizard. File → Budget/Actual → column mapping (review points R1–R3) → summary.
 * The proposal comes from the data source (heuristics, AI fallback when enabled); the owner confirms.
 */
export function ImportWizard({ ws, initialType, samples }: { ws: string; initialType?: "actual" | "budget"; samples: { label: string; href: string }[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("file");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [type, setType] = useState<"actual" | "budget">(initialType ?? "actual");
  const [columns, setColumns] = useState<Partial<Record<MappingField, string>>>({});
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const receive = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const res = await proposeImportAction(ws, form);
      if (!res.ok) return setError(res.error);
      const p = res.data;
      setPreview(p);
      if (p.alreadyImported) return setStep("done");
      setType(initialType ?? p.proposal.type);
      setColumns(Object.fromEntries(Object.entries(p.proposal.fields).map(([f, m]) => [f, m!.column])) as Partial<Record<MappingField, string>>);
      setStep("type");
    });
  };

  const loadSample = (href: string, name: string) =>
    start(async () => {
      const res = await fetch(href);
      receive(new File([await res.blob()], name, { type: "text/csv" }));
    });

  const fields = FIELDS[type];
  const ambiguous = new Set(preview?.proposal.ambiguous.map((a) => a.field) ?? []);
  const missing = fields.filter((f) => f.required && !columns[f.field]);
  const used = Object.values(columns).filter(Boolean);
  const duplicate = used.length !== new Set(used).size;

  const apply = () => {
    if (!preview) return;
    const mapping: MappingProposal = {
      type,
      ambiguous: [],
      fields: Object.fromEntries(
        Object.entries(columns)
          .filter(([, c]) => c)
          .map(([f, c]) => [f, { column: c!, confidence: 1, samples: preview.sampleRows.map((r) => r[c!] ?? "").filter(Boolean).slice(0, 3) }]),
      ),
    };
    start(async () => {
      const res = await applyImportAction(ws, preview.importId, mapping);
      if (!res.ok) {
        toast.error("Import failed", { description: res.error });
        return;
      }
      setResult(res.data);
      setStep("done");
      toast.success(`${pluralize(res.data.counts.new, "row")} imported`, { description: preview.fileName });
      router.refresh();
    });
  };

  const reset = () => {
    setStep("file");
    setPreview(null);
    setResult(null);
    setColumns({});
    setError(null);
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2 text-sm" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full border text-xs transition-colors duration-200 ${
                i < stepIndex ? "border-foreground bg-foreground text-background" : i === stepIndex ? "border-brand text-brand" : "text-muted-foreground"
              }`}
              aria-current={i === stepIndex ? "step" : undefined}
            >
              {i < stepIndex ? <CheckIcon className="size-3.5" /> : i + 1}
            </span>
            <span className={i === stepIndex ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden />}
          </li>
        ))}
      </ol>

      {step === "file" && (
        <div className="enter space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              receive(e.dataTransfer.files[0]);
            }}
            disabled={pending}
            className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-[border-color,background-color] duration-150 ${
              dragging ? "border-brand bg-brand-subtle/50" : "hover:border-foreground/25 hover:bg-muted/30"
            }`}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              {pending ? <Loader2Icon className="size-5 animate-spin text-muted-foreground" /> : <UploadCloudIcon className="size-5 text-muted-foreground" />}
            </span>
            <span className="space-y-1">
              <span className="block font-medium">{pending ? "Reading your file…" : "Drop a CSV here, or click to choose"}</span>
              <span className="block text-sm text-muted-foreground">Bank exports, accounting exports or a budget sheet saved as .csv · up to 2 MB</span>
            </span>
          </button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => receive(e.target.files?.[0])} />
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-negative">
              <AlertTriangleIcon className="size-4" /> {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>No file handy? Try a sample:</span>
            {samples.map((s) => (
              <Button key={s.href} variant="outline" size="xs" disabled={pending} onClick={() => loadSample(s.href, s.href.split("/").pop()!)}>
                <FileSpreadsheetIcon /> {s.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {step === "type" && preview && (
        <div className="enter space-y-4">
          <FileChip preview={preview} />
          <p className="text-sm text-muted-foreground">What does this file contain? We guessed from its columns.</p>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Import type">
            {(["actual", "budget"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => {
                  setType(t);
                }}
                className={`pressable rounded-xl border p-4 text-left transition-colors ${type === t ? "border-brand ring-3 ring-brand/15" : "hover:border-foreground/25"}`}
              >
                <span className="flex items-center justify-between">
                  <span className="font-medium">{t === "actual" ? "Actual transactions" : "Budget"}</span>
                  {preview.proposal.type === t && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Our guess</span>}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t === "actual" ? "Money that moved: adds transactions and updates recorded figures." : "Planned amounts per period: updates budget figures."}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" onClick={reset}>
              <ArrowLeftIcon /> Choose another file
            </Button>
            <Button variant="brand" size="sm" onClick={() => setStep("mapping")}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "mapping" && preview && (
        <div className="enter space-y-4">
          <FileChip preview={preview} />
          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[120px_minmax(0,220px)_minmax(0,1fr)] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground max-sm:grid-cols-[100px_minmax(0,1fr)]">
              <span>Field</span>
              <span>Column in your file</span>
              <span className="max-sm:hidden">Values from your file</span>
            </div>
            {fields.map(({ field, label, required }) => {
              const col = columns[field];
              const proposed = preview.proposal.fields[field];
              const needsChoice = ambiguous.has(field) && !col;
              const badge = needsChoice
                ? { text: "Needs your choice", cls: "bg-warning/15 text-warning" }
                : proposed && proposed.column === col
                  ? proposed.confidence < 0.9
                    ? { text: "Suggested by AI", cls: "bg-brand-subtle text-brand", icon: true }
                    : { text: "Matched header", cls: "bg-muted text-muted-foreground" }
                  : col
                    ? { text: "Chosen by you", cls: "bg-foreground/5 text-foreground" }
                    : null;
              return (
                <div key={field} className="grid grid-cols-[120px_minmax(0,220px)_minmax(0,1fr)] items-center gap-4 border-b border-border/60 px-4 py-3 last:border-b-0 max-sm:grid-cols-[100px_minmax(0,1fr)]">
                  <span className="text-sm">
                    <span className="font-medium">{label}</span>
                    {required && <span className="text-muted-foreground"> *</span>}
                    {badge && (
                      <span className={`mt-1 flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${badge.cls}`}>
                        {"icon" in badge && <SparklesIcon className="size-2.5" />}
                        {badge.text}
                      </span>
                    )}
                  </span>
                  <Select value={col ?? NONE} onValueChange={(v) => setColumns((c) => ({ ...c, [field]: v === NONE ? undefined : v }))}>
                    <SelectTrigger size="sm" className={`h-8 w-full ${needsChoice || (required && !col) ? "border-warning" : ""}`} aria-label={`${label} column`}>
                      <SelectValue placeholder="Choose a column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{required ? "Choose a column" : "Not in this file"}</SelectItem>
                      {preview.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                          {ambiguous.has(field) && preview.proposal.ambiguous.find((a) => a.field === field)?.candidates.includes(h) ? " · candidate" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex min-w-0 gap-1.5 overflow-hidden max-sm:hidden">
                    {col
                      ? preview.sampleRows.slice(0, 3).map((r, i) => (
                          <code key={i} className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{r[col] || "∅"}</code>
                        ))
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </span>
                </div>
              );
            })}
          </div>
          {duplicate && <p className="text-sm text-warning">Two fields point at the same column. Each column can feed one field.</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep("type")}>
              <ArrowLeftIcon /> Back
            </Button>
            <div className="flex items-center gap-3">
              {missing.length > 0 && <span className="text-xs text-muted-foreground">Choose a column for {missing.map((m) => m.label).join(", ")}</span>}
              <Button variant="brand" size="sm" onClick={apply} disabled={pending || missing.length > 0 || duplicate}>
                {pending ? <Loader2Icon className="animate-spin" /> : <WandSparklesIcon />}
                Import {pluralize(preview.rowCount, "row")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && preview && (
        <div className="enter space-y-5">
          {preview.alreadyImported ? (
            <div className="flex items-start gap-3 rounded-xl border p-4">
              <CheckCircle2Icon className="mt-0.5 size-5 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">This file was already imported</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{preview.fileName}</span> matches a file you uploaded before, byte for byte. Nothing was added, so every transaction still counts once.
                </p>
              </div>
            </div>
          ) : (
            result && (
              <>
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
                  <Stat label="New" value={result.counts.new} tone="brand" />
                  <Stat label="Already imported" value={result.counts.repeat} hint="Skipped, counted once" />
                  <Stat label="Flagged" value={result.counts.flagged} tone={result.counts.flagged ? "warning" : undefined} hint={result.counts.flagged ? "Not counted until fixed" : undefined} />
                </div>
                {result.changed.deltas.filter((d) => d.field !== "variance").length > 0 && (
                  <div className="rounded-xl border p-4">
                    <p className="mb-3 text-sm font-medium">What changed</p>
                    <ul className="space-y-2">
                      {result.changed.deltas
                        .filter((d) => d.field !== "variance")
                        .map((d, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-x-2 text-sm">
                            <span className="font-medium">{d.category}</span>
                            <span className="text-muted-foreground">{d.field} · {formatPeriod(d.period)}</span>
                            <span className="num text-muted-foreground">{formatMinor(d.beforeMinor, d.currency)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="num font-medium">{formatMinor(d.afterMinor, d.currency)}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </>
            )
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="sm" asChild>
              <Link href={wsPath(ws)}>See overview</Link>
            </Button>
            {result && result.counts.flagged > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={wsPath(ws, "/review")}>Review {pluralize(result.counts.flagged, "flag")}</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={reset}>
              Import another file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileChip({ preview }: { preview: ImportPreview }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <FileSpreadsheetIcon className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{preview.fileName}</span>
      <span className="text-xs text-muted-foreground">{pluralize(preview.rowCount, "row")} · {pluralize(preview.headers.length, "column")}</span>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "brand" | "warning" }) {
  return (
    <div className="bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold ${tone === "brand" ? "text-brand" : tone === "warning" ? "text-warning" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
