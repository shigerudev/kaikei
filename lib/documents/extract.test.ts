import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/env", () => ({
  env: () => ({
    DATABASE_URL: "postgres://localhost/test",
    AI_ENABLED: process.env.TEST_AI_ENABLED === "true",
    AI_MODEL: "test-model",
    OPENAI_API_KEY: "test",
    APP_URL: "http://localhost:3000",
  }),
}));

vi.mock("@/lib/ai/store", () => ({
  contextHash: () => "hash",
  storeAiSuggestion: vi.fn(async () => "sug-id"),
}));

vi.mock("@/lib/ai/model", () => ({
  createSuggestModel: vi.fn(),
}));

import { createSuggestModel } from "@/lib/ai/model";
import { extractDocument } from "./extract";

const BILL_PATH = resolve(__dirname, "../../fixtures/bill_transportes_rapidos.pdf");

describe("extractDocument + bill fixture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TEST_AI_ENABLED;
  });

  it("fixture PDF exists and contains walkthrough text", () => {
    const bytes = readFileSync(BILL_PATH, "utf8");
    expect(bytes).toContain("%PDF");
    expect(bytes).toContain("Transportes Rapidos");
    expect(bytes).toContain("2026-11-18");
    expect(bytes).toContain("GTQ");
    expect(bytes).toContain("Q600.00");
  });

  it("AI off → null (manual entry path)", async () => {
    const out = await extractDocument({
      workspaceId: "ws",
      documentId: "11111111-1111-4111-8111-111111111111",
      pdfUrl: "file://" + BILL_PATH,
      pdfText: readFileSync(BILL_PATH, "utf8"),
    });
    expect(out).toBeNull();
  });

  it("AI on + mocked model → Q600 GTQ 2026-11-18", async () => {
    process.env.TEST_AI_ENABLED = "true";
    vi.mocked(createSuggestModel).mockReturnValue({
      withStructuredOutput: () => ({
        invoke: async () => ({
          supplier: "Transportes Rápidos",
          date: "2026-11-18",
          currency: "GTQ",
          total_minor: 60000,
          confidence: { supplier: 0.9, date: 0.9, currency: 0.9, total_minor: 0.9 },
        }),
      }),
    } as never);

    const out = await extractDocument({
      workspaceId: "ws",
      documentId: "11111111-1111-4111-8111-111111111111",
      pdfUrl: "file://" + BILL_PATH,
      pdfText: readFileSync(BILL_PATH, "utf8"),
    });

    expect(out).toEqual({
      supplier: "Transportes Rápidos",
      date: "2026-11-18",
      currency: "GTQ",
      total_minor: 60000,
      confidence: {
        supplier: 0.9,
        date: 0.9,
        currency: 0.9,
        total_minor: 0.9,
      },
    });
  });
});
