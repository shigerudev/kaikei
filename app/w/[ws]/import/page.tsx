import { ImportWizard } from "@/components/import/import-wizard";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { getWorkspaceInfo } from "@/lib/data";

export const metadata = { title: "Import" };

const SAMPLES = [
  { label: "Actuals · Nov", href: "/samples/sample_actuals_nov.csv" },
  { label: "Budget · Nov", href: "/samples/sample_budget_nov.csv" },
  { label: "Budget · Dec", href: "/samples/sample_budget_dec.csv" },
];

/** Screen 3: import wizard. */
export default async function ImportPage({ params, searchParams }: PageProps<"/w/[ws]/import">) {
  const { ws } = await params;
  const { type } = await searchParams;
  const info = await getWorkspaceInfo(ws);
  return (
    <>
      <PageHeader crumbs={[{ label: "Import" }]} preview={info?.dataSource === "preview"} />
      <PageBody className="max-w-3xl">
        <PageTitle
          title="Import a CSV"
          description="We keep your original file untouched, propose how its columns map, and count every transaction once — even if you upload an overlapping export."
        />
        <ImportWizard ws={ws} initialType={type === "budget" || type === "actual" ? type : undefined} samples={SAMPLES} />
      </PageBody>
    </>
  );
}
