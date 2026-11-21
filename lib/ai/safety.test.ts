/**
 * PIPER-39 / AC12–AC14 unit coverage (AI on/off, injection resistance, invented IDs).
 * Full E2E AC12 still needs seeded DB + fixtures from Jordi/Jose.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { proposeByHeuristics } from "@/lib/mapping";

vi.mock("@/lib/env", () => ({
  env: () => ({
    DATABASE_URL: "postgres://localhost/test",
    AI_ENABLED: process.env.TEST_AI_ENABLED === "true",
    AI_MODEL: "test-model",
    OPENAI_API_KEY: "test",
    AI_GATEWAY_API_KEY: undefined,
    OPENAI_BASE_URL: undefined,
    APP_URL: "http://localhost:3000",
  }),
}));

vi.mock("./store", () => ({
  contextHash: () => "hash",
  storeAiSuggestion: vi.fn(async () => "sug-id"),
}));

vi.mock("./model", () => ({
  createSuggestModel: vi.fn(),
}));

import { suggest } from "./suggest";
import { storeAiSuggestion } from "./store";
import { createSuggestModel } from "./model";
import { extractDocument } from "@/lib/documents/extract";

describe("AC12 AI on/off parity (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TEST_AI_ENABLED;
  });

  it("AI off: extractDocument returns null (manual path) and never calls the model", async () => {
    const out = await extractDocument({
      workspaceId: "ws",
      documentId: "11111111-1111-4111-8111-111111111111",
      pdfUrl: "https://example.com/bill.pdf",
      pdfText: "Transportes Rapidos GTQ 600.00 2026-11-18",
    });
    expect(out).toBeNull();
    expect(createSuggestModel).not.toHaveBeenCalled();
  });

  it("AI off: suggest returns null without audit write", async () => {
    const out = await suggest({
      workspaceId: "ws",
      capability: "column_mapping",
      targetRef: "import:1",
      promptVersion: "t",
      system: "sys",
      data: {},
      schema: z.object({ x: z.string() }),
    });
    expect(out).toBeNull();
    expect(storeAiSuggestion).not.toHaveBeenCalled();
  });
});

describe("AC13 adversarial injection (heuristics)", () => {
  it("does not follow injection text in Concepto; still maps standard headers", () => {
    const csv = readFileSync(
      resolve(__dirname, "../../fixtures/adversarial_actuals.csv"),
      "utf8",
    );
    const [headerLine, ...rows] = csv.trim().split("\n");
    const headers = headerLine!.split(",");
    const sampleRows = rows.map((line) => {
      // naive CSV split sufficient for this fixture
      const cols = line.match(/(".*?"|[^,]+)/g)!.map((c) => c.replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
    });

    const proposal = proposeByHeuristics({
      workspaceId: "ws",
      importId: "imp",
      headers,
      sampleRows,
    });

    expect(proposal.fields.amount?.column).toBe("Monto (Q)");
    expect(proposal.fields.date?.column).toBe("Fecha");
    // Unresolvable header stays unmapped (LLM fallback territory)
    expect(proposal.fields).not.toHaveProperty("ignore");
    const mappedColumns = Object.values(proposal.fields).map((f) => f!.column);
    expect(mappedColumns).not.toContain("Imp. neto");
  });
});

describe("AC14 invented id rejected + audit row", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEST_AI_ENABLED = "true";
  });

  it("stores rejected and returns null when checkReal rejects invented id", async () => {
    vi.mocked(createSuggestModel).mockReturnValue({
      withStructuredOutput: () => ({
        invoke: async () => ({
          transaction_id: "99999999-9999-4999-8999-999999999999",
          rationale: "made up",
        }),
      }),
    } as never);

    const allowed = new Set(["11111111-1111-4111-8111-111111111111"]);
    const Schema = z.object({
      transaction_id: z.string().uuid(),
      rationale: z.string(),
    });

    const out = await suggest({
      workspaceId: "ws",
      capability: "match_tiebreak",
      targetRef: "document:1",
      promptVersion: "t",
      system: "sys",
      data: { candidates: [...allowed] },
      schema: Schema,
      checkReal: (p) =>
        allowed.has(p.transaction_id) ? null : "invented transaction id",
    });

    expect(out).toBeNull();
    expect(storeAiSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        validationStatus: "rejected",
        rationale: "invented transaction id",
      }),
    );
  });
});
