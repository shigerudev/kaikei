/**
 * Stage ④c PDF extraction (owner: Hugo). Produces K4 via `suggest()`.
 * Validate: date parses, total > 0, ISO currency. When AI is off → null (manual UI).
 */
import { z } from "zod";
import { suggest } from "@/lib/ai/suggest";
import { Currency, Extraction, IsoDate, type Extraction as ExtractionType } from "@/lib/types";

/** Schema sent to the model (total as positive minor units). */
const ExtractionLlm = z.object({
  supplier: z.string().min(1),
  date: IsoDate,
  currency: Currency,
  total_minor: z.number().int().positive(),
  confidence: z.record(z.string(), z.number().min(0).max(1)),
  rationale: z.string().optional(),
});

export async function extractDocument(input: {
  workspaceId: string;
  documentId: string;
  pdfUrl: string;
  /** Optional pre-extracted text (avoids fetching PDF in the model path). */
  pdfText?: string;
}): Promise<ExtractionType | null> {
  const suggestion = await suggest({
    workspaceId: input.workspaceId,
    capability: "pdf_extraction",
    targetRef: `document:${input.documentId}`,
    promptVersion: "pdf_extraction.v1",
    system:
      "Extract supplier, date (YYYY-MM-DD), ISO currency, and total in minor units (integer cents) from the bill. total_minor must be > 0.",
    data: {
      pdfUrl: input.pdfUrl,
      text: input.pdfText ?? null,
    },
    file: { url: input.pdfUrl, mediaType: "application/pdf" },
    schema: ExtractionLlm,
    checkReal: (p) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || Number.isNaN(Date.parse(`${p.date}T00:00:00Z`))) {
        return "invalid date";
      }
      if (p.total_minor <= 0) return "total must be > 0";
      if (!/^[A-Z]{3}$/.test(p.currency)) return "invalid currency";
      return null;
    },
  });

  if (!suggestion) return null;
  return Extraction.parse({
    supplier: suggestion.proposed.supplier,
    date: suggestion.proposed.date,
    currency: suggestion.proposed.currency,
    total_minor: suggestion.proposed.total_minor,
    confidence: suggestion.proposed.confidence,
  });
}
