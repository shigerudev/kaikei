import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Screen 7: Review queue. */
export default function ReviewPage() {
  return (
    <ScreenPlaceholder
      title="Review"
      owner="Jordi (UI) · Deyane (API)"
      purpose="Flags with reason, file, row/column and a link to the record; resolve or dismiss."
      todo={[
        "List via flags.listFlags(ws, 'open')",
        "Resolve / Dismiss → PATCH /api/w/[ws]/flags/[id]",
        "Cut-list item 5: if behind, show flags inline on records only",
      ]}
    />
  );
}
