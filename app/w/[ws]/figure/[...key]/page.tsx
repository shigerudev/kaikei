import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Screen 4: Figure drilldown. URL: /w/<ws>/figure/<period>/<category>/<currency> */
export default async function FigurePage({ params }: PageProps<"/w/[ws]/figure/[...key]">) {
  const { key } = await params;
  const [period, category, currency] = key.map(decodeURIComponent);
  return (
    <ScreenPlaceholder
      title={`${category ?? "?"} · ${period ?? "?"} · ${currency ?? "?"}`}
      owner="Jordi"
      purpose="Figure → contributing transactions, with their sum shown equal to the figure (AC8)."
      todo={[
        "Call metrics.getVariance(ws, period, category, currency)",
        "Rows: date, description, amount, 📎 if evidence confirmed → /transactions/<id>",
        "Footer: Σ contributors = figure",
      ]}
    />
  );
}
