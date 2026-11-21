import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Screen 3: Import wizard. */
export default function ImportPage() {
  return (
    <ScreenPlaceholder
      title="Upload a file"
      owner="Jordi"
      purpose="Upload → type (Budget / Actual) → mapping with raw sample values and confidence → summary → apply."
      todo={[
        "Drop zone for CSV or PDF → POST /api/w/[ws]/upload (PDF redirects to /documents/<id>)",
        "Type picker, pre-selected from the proposal (R2)",
        "Mapping table: field → column, confidence badge, raw sample values; ambiguous fields block Apply (R1, AC3)",
        "Provenance badge: “Suggested by AI” vs heuristic",
        "Apply → POST /api/w/[ws]/imports/[id]/apply → summary: new / already imported / flagged",
        "Repeat file: “This file was already imported. 0 new.”",
      ]}
    />
  );
}
