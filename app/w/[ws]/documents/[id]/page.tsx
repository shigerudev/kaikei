import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Screen 6: Document review. */
export default async function DocumentPage({ params }: PageProps<"/w/[ws]/documents/[id]">) {
  const { id } = await params;
  return (
    <ScreenPlaceholder
      title={`Bill ${id.slice(0, 8)}`}
      owner="Jordi (UI) · Hugo (extract + match)"
      purpose="PDF page left; extracted supplier / date / currency / total right (editable); suggested match; Confirm / Not this one."
      todo={[
        "PDF page via react-pdf (client component)",
        "Editable fields (manual entry when AI_ENABLED=false) — R4",
        "Match card with reasons (amount_exact, date_within_3d, supplier_in_description)",
        "Confirm / Not this one → POST /api/w/[ws]/documents/[id]/match — R5",
      ]}
    />
  );
}
