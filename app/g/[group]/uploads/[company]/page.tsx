import { FileSpreadsheetIcon, SearchXIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { CompanyTag } from "@/components/badges";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApproveMapping } from "@/components/uploads/approve-mapping";
import { dataSource, getCompanies, getFilePreview, getFiles, getRun } from "@/lib/api";
import { formatAmount, formatPeriod } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

export const metadata = { title: "Pack preview" };

/** A company's pack as parsed: raw cell → canonical record, plus the account mapping to approve. */
export default async function CompanyUploadPage({ params }: PageProps<"/g/[group]/uploads/[company]">) {
  const { group, company } = await params;
  const preview = dataSource() === "preview";
  const result = await load(async () => {
    const [companies, files, run] = await Promise.all([getCompanies(group), getFiles(group), getRun(group)]);
    const c = companies.find((x) => x.id === company) ?? null;
    const f = files.find((x) => x.company_id === company) ?? null;
    const pv = f && f.status !== "MISSING" ? await getFilePreview(f.id) : null;
    return { c, f, pv, run };
  });
  const c = result.ok ? result.data.c : null;

  return (
    <>
      <PageHeader group={group} crumbs={[{ label: "Uploads", href: gPath(group, "/uploads") }, { label: c?.name ?? company }]} run={result.ok ? result.data.run : null} preview={preview} />
      <PageBody className="max-w-6xl">
        {!result.ok ? (
          result.node
        ) : !c ? (
          <EmptyState icon={SearchXIcon} title="Unknown company" description={`${company} isn't part of this group.`} />
        ) : (
          <>
            <PageTitle
              title={c.name}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <CompanyTag id={c.id} /> {c.country} · {c.functional_currency} · aliases: {c.aliases.join(", ")}
                </span>
              }
            >
              {result.data.f && result.data.f.status !== "MISSING" && (
                <ApproveMapping group={group} companyId={c.id} approved={result.data.f.status === "MAPPING_APPROVED"} />
              )}
            </PageTitle>

            {!result.data.f || result.data.f.status === "MISSING" || !result.data.pv ? (
              <EmptyState icon={UploadIcon} title="No pack uploaded yet" description={`Expected: ${c.filename} — ${c.format}.`}>
                <Button variant="brand" size="sm" asChild>
                  <Link href={gPath(group, "/uploads")}>Upload packs</Link>
                </Button>
              </EmptyState>
            ) : (
              <>
                <section className="grid gap-px overflow-hidden rounded-xl border bg-border text-sm sm:grid-cols-4">
                  {[
                    ["File", <span key="f" className="flex items-center gap-1.5 truncate font-mono text-xs"><FileSpreadsheetIcon className="size-3.5 shrink-0" />{result.data.f.filename}</span>],
                    ["SHA-256", <span key="s" className="truncate font-mono text-xs">{result.data.f.sha256}</span>],
                    ["Lines · records", <span key="r" className="num">{result.data.f.rows} · {result.data.f.records}</span>],
                    ["Format", <span key="t" className="line-clamp-2 text-xs">{c.format}</span>],
                  ].map(([k, v]) => (
                    <div key={k as string} className="min-w-0 bg-background p-3">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <div className="mt-1 min-w-0">{v}</div>
                    </div>
                  ))}
                </section>

                <Tabs defaultValue="rows" className="gap-4">
                  <TabsList>
                    <TabsTrigger value="rows">Parsed rows</TabsTrigger>
                    <TabsTrigger value="mapping">Account mapping ({result.data.pv.account_mapping.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="rows" className="space-y-2">
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[820px] text-sm">
                        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Source cell</th>
                            <th className="px-3 py-2 text-left font-medium">Raw</th>
                            <th className="px-3 py-2 text-left font-medium">Period</th>
                            <th className="px-3 py-2 text-left font-medium">Local account</th>
                            <th className="px-3 py-2 text-left font-medium">Group account</th>
                            <th className="px-3 py-2 text-right font-medium">Amount ({c.functional_currency})</th>
                            <th className="px-4 py-2 text-left font-medium">Partner</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.pv.rows.map((r) => (
                            <tr key={r.source.cell} className="border-b border-border/60 last:border-b-0">
                              <td className="px-4 py-2 font-mono text-xs">{r.source.cell?.split("!")[1]}</td>
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">“{r.source.raw}”</td>
                              <td className="num px-3 py-2 text-muted-foreground">{formatPeriod(r.period)}</td>
                              <td className="max-w-56 truncate px-3 py-2">{r.local_account !== r.local_name ? <span className="mr-1 font-mono text-xs text-muted-foreground">{r.local_account}</span> : null}{r.local_name}</td>
                              <td className="px-3 py-2 font-mono text-xs">{r.group_account ?? <span className="text-negative">unmapped</span>}</td>
                              <td className="num px-3 py-2 text-right">{formatAmount(r.amount_local, { dp: 2 })}</td>
                              <td className="px-4 py-2">{r.partner_company_id ? <CompanyTag id={r.partner_company_id} /> : <span className="text-muted-foreground">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">First rows as normalized: signed in each account&apos;s normal balance, locale-aware numbers, partners resolved through the alias table.</p>
                  </TabsContent>
                  <TabsContent value="mapping">
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Local code</th>
                            <th className="px-3 py-2 text-left font-medium">Local name</th>
                            <th className="px-3 py-2 text-left font-medium">Group account</th>
                            <th className="px-3 py-2 text-left font-medium">Type</th>
                            <th className="px-4 py-2 text-left font-medium">Counterparty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.pv.account_mapping.map((m) => (
                            <tr key={`${m.local_code}-${m.local_name}`} className="border-b border-border/60 last:border-b-0">
                              <td className="px-4 py-2 font-mono text-xs">{m.local_code || "—"}</td>
                              <td className="px-3 py-2">{m.local_name}</td>
                              <td className="px-3 py-2 font-mono text-xs">{m.group_account}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{m.type}</td>
                              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{m.partner ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
