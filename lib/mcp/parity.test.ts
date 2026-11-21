import { describe, expect, it } from "vitest";
import {
  buildParityTemplate,
  evaluateParityRow,
  expectedWalkthrough,
} from "./parity";
import { TOOL_COPY, CATEGORY_ALIAS_HINT, WALKTHROUGH_ES } from "./descriptions";

describe("AC9 MCP bilingual + parity", () => {
  it("every tool description is bilingual and lists category aliases", () => {
    for (const tool of Object.values(TOOL_COPY)) {
      expect(tool.description).toContain("EN:");
      expect(tool.description).toContain("ES:");
      expect(tool.description).toContain(CATEGORY_ALIAS_HINT.slice(0, 20));
      expect(tool.title).toMatch(/\//);
    }
    expect(TOOL_COPY.get_budget_variance.description).toContain(WALKTHROUGH_ES.slice(0, 20));
  });

  it("parity template has one row per client defaulting to not_verified", () => {
    const rows = buildParityTemplate();
    expect(rows.map((r) => r.client)).toEqual(["grok", "claude", "chatgpt"]);
    expect(rows.every((r) => r.status === "not_verified")).toBe(true);
    const exp = expectedWalkthrough();
    expect(rows[0]!.expected_actual_minor).toBe(exp.actualMinor);
    expect(exp.actualMinor).toBe("330000");
    expect(exp.varianceMinor).toBe("30000");
  });

  it("evaluateParityRow passes when tool minors match golden", () => {
    const [row] = buildParityTemplate();
    const scored = evaluateParityRow({
      ...row!,
      tool_output_actual_minor: "330000",
      tool_output_variance_minor: "30000",
    });
    expect(scored.status).toBe("pass");
  });

  it("evaluateParityRow fails on mismatch", () => {
    const [row] = buildParityTemplate();
    const scored = evaluateParityRow({
      ...row!,
      tool_output_actual_minor: "999",
      tool_output_variance_minor: "30000",
    });
    expect(scored.status).toBe("fail");
  });
});
