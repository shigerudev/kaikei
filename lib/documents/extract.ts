/**
 * Stage ④c PDF extraction (owner: Hugo). Produces K4 via `suggest()` with the PDF as a file input.
 * Validate: date parses, total > 0, ISO currency. When AI is off → null, and the UI shows manual entry.
 * Review point R4: the owner always sees the page beside the fields and can edit them.
 */
import type { Extraction } from "@/lib/types";
import { notImplemented } from "@/lib/not-implemented";

export async function extractDocument(input: {
  workspaceId: string;
  documentId: string;
  pdfUrl: string;
}): Promise<Extraction | null> {
  void input;
  return notImplemented("documents.extractDocument", "Hugo");
}
