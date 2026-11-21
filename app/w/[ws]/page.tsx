import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Screen 2: Overview. Renders ONLY metrics.getOverview + metrics.whatChanged output. */
export default async function OverviewPage({ searchParams }: PageProps<"/w/[ws]">) {
  const { period } = await searchParams;
  return (
    <ScreenPlaceholder
      title={`Overview${typeof period === "string" ? ` · ${period}` : ""}`}
      owner="Jordi"
      purpose="Budget, actual and variance per category for a period; cash in/out; what changed; open flags."
      todo={[
        "Period picker (?period=YYYY-MM)",
        "Category table: budget / actual / variance (over budget in red); every figure links to /figure/<period>/<category>/<currency>",
        "Cash in / out (getCashflow — cut-list item 2: MCP-only if behind)",
        "“What changed since last upload” panel (whatChanged)",
        "Review count → /review",
      ]}
    />
  );
}
