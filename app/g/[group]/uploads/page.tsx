import { ArrowRightIcon, CircleDashedIcon, CheckIcon, FileSpreadsheetIcon } from "lucide-react";
import Link from "next/link";
import { CompanyTag } from "@/components/badges";
import { StartRunButton } from "@/components/runs/run-actions";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { load } from "@/components/states";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";
import { dataSource, getCompanies, getFiles, getRun } from "@/lib/api";
import type { FileStatus } from "@/lib/api/types";
import { formatStamp, shortHash } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

export const metadata = { title: "Cargas" };

const STATUS: Record<FileStatus, { label: string; cls: string }> = {
  MISSING: { label: "Esperando archivo", cls: "text-muted-foreground" },
  UPLOADED: { label: "Revisar mapeo", cls: "text-warning" },
  MAPPING_APPROVED: { label: "Listo", cls: "text-brand" },
  REJECTED: { label: "Rechazado", cls: "text-negative" },
};

/** Screen 2: upload wizard — one pack per company, preview as parsed, mapping approval. */
export default async function UploadsPage({ params }: PageProps<"/g/[group]/uploads">) {
  const { group } = await params;
  const preview = dataSource() === "preview";
  const result = await load(() => Promise.all([getCompanies(group), getFiles(group), getRun(group)]));

  if (!result.ok)
    return (
      <>
        <PageHeader group={group} crumbs={[{ label: "Cargas" }]} preview={preview} />
        <PageBody>{result.node}</PageBody>
      </>
    );

  const [companies, files, run] = result.data;
  const fileOf = (id: string) => files.find((f) => f.company_id === id);
  const ready = companies.filter((c) => fileOf(c.id)?.status === "MAPPING_APPROVED").length;
  const allReady = ready === companies.length;

  return (
    <>
      <PageHeader group={group} crumbs={[{ label: "Cargas" }]} run={run} preview={preview} />
      <PageBody className="max-w-5xl">
        <PageTitle
          title="Paquetes de las empresas"
          description="Un paquete de presupuesto por empresa, en el formato que llegue. Los originales se guardan sin cambios con su SHA-256; cada valor conserva su archivo, fila y celda."
        >
          {allReady && <StartRunButton group={group} variant="brand" />}
        </PageTitle>

        <UploadDropzone group={group} preview={preview} companies={companies.map((c) => ({ id: c.id, name: c.name }))} />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Empresas</h2>
            <p className="num text-xs text-muted-foreground">
              {ready} de {companies.length} listas para ejecutar
            </p>
          </div>
          <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-(--ease-out)" style={{ width: `${(ready / Math.max(companies.length, 1)) * 100}%` }} />
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {companies.map((c, i) => {
              const f = fileOf(c.id);
              const st = STATUS[f?.status ?? "MISSING"];
              const has = f && f.status !== "MISSING";
              return (
                <li key={c.id} style={{ "--i": i } as React.CSSProperties} className="enter">
                  <Link
                    href={gPath(group, `/uploads/${c.id}`)}
                    className="group flex h-full flex-col gap-3 rounded-xl border p-4 transition-[border-color,background-color] hover:border-foreground/20 hover:bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <CompanyTag id={c.id} name={c.name} />
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.country} · {c.functional_currency} · {c.ownership_pct}% · consolidación total
                        </p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${st.cls}`}>
                        {f?.status === "MAPPING_APPROVED" ? <CheckIcon className="size-3.5" /> : <CircleDashedIcon className="size-3.5" />}
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 font-mono text-xs">
                      <FileSpreadsheetIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className={`truncate ${has ? "" : "text-muted-foreground"}`}>{has ? f.filename : c.filename}</span>
                      {has && f.sha256 && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{shortHash(f.sha256)}</span>}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{c.format}</p>
                    <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                      <span>{has ? `${f.records ?? 0} registros · ${f.uploaded_at ? formatStamp(f.uploaded_at) : ""}` : "Sin subir"}</span>
                      <span className="flex items-center gap-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        {has ? "Vista previa" : "Detalles"} <ArrowRightIcon className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </PageBody>
    </>
  );
}
