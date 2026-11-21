import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

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

const Schema = z.object({ value: z.string() });

describe("suggest()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TEST_AI_ENABLED;
  });

  it("returns null with AI_ENABLED=false and never calls the model", async () => {
    const result = await suggest({
      workspaceId: "ws",
      capability: "column_mapping",
      targetRef: "import:1",
      promptVersion: "t",
      system: "sys",
      data: { x: 1 },
      schema: Schema,
    });
    expect(result).toBeNull();
    expect(createSuggestModel).not.toHaveBeenCalled();
    expect(storeAiSuggestion).not.toHaveBeenCalled();
  });

  it("stores rejected and returns null when checkReal fails", async () => {
    process.env.TEST_AI_ENABLED = "true";
    vi.mocked(createSuggestModel).mockReturnValue({
      withStructuredOutput: () => ({
        invoke: async () => ({ value: "ok" }),
      }),
    } as never);

    const result = await suggest({
      workspaceId: "ws",
      capability: "match_tiebreak",
      targetRef: "document:1",
      promptVersion: "t",
      system: "sys",
      data: {},
      schema: Schema,
      checkReal: () => "invented id",
    });

    expect(result).toBeNull();
    expect(storeAiSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ validationStatus: "rejected" }),
    );
  });

  it("returns valid envelope when schema + checkReal pass", async () => {
    process.env.TEST_AI_ENABLED = "true";
    vi.mocked(createSuggestModel).mockReturnValue({
      withStructuredOutput: () => ({
        invoke: async () => ({ value: "ok" }),
      }),
    } as never);

    const result = await suggest({
      workspaceId: "ws",
      capability: "pdf_extraction",
      targetRef: "document:1",
      promptVersion: "t",
      system: "sys",
      data: {},
      schema: Schema,
    });

    expect(result?.proposed).toEqual({ value: "ok" });
    expect(result?.validation_status).toBe("valid");
    expect(storeAiSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ validationStatus: "valid" }),
    );
  });
});
