import { ScreenPlaceholder } from "@/components/screen-placeholder";

/**
 * Screen 5: Transaction drawer. Also a standalone page so MCP deep links (`app_url`) land somewhere.
 * TODO(Jordi): render as a Sheet over the drilldown via an intercepting route if time allows.
 */
export default async function TransactionPage({ params }: PageProps<"/w/[ws]/transactions/[id]">) {
  const { id } = await params;
  return (
    <ScreenPlaceholder
      title={`Transaction ${id.slice(0, 8)}`}
      owner="Jordi"
      purpose="Fields, original CSV row (raw), source file + row number, linked bill, match suggestions."
      todo={[
        "Raw CSV row from source_rows.raw, with file name + row number",
        "📎 linked bill thumbnail → /documents/<id>",
        "Provenance badges: “Flagged by rule” / “Confirmed by you”",
      ]}
    />
  );
}
