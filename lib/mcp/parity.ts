/**
 * AC9 — 3-client MCP parity checklist (Grok, Claude, ChatGPT).
 * Automated harness records one row per client. Live connector runs are
 * marked `not_verified` until a human pastes tool output vs expected figures.
 */
import golden from "../../fixtures/golden.json" with { type: "json" };

export type ParityClient = "grok" | "claude" | "chatgpt";
export type ParityStatus = "pass" | "fail" | "not_verified";

export type ParityRow = {
  client: ParityClient;
  status: ParityStatus;
  question_es: string;
  expected_actual_minor: string;
  expected_variance_minor: string;
  tool_output_actual_minor: string | null;
  tool_output_variance_minor: string | null;
  notes: string;
};

export const DEMO_QUESTION_ES =
  "¿Por qué Deliveries está sobre presupuesto en noviembre 2026? Dame el real, el presupuesto y la variación.";

/** Expected walkthrough numbers (hand-computed golden). */
export function expectedWalkthrough() {
  const d = golden.afterUpload.deliveries;
  return {
    budgetMinor: d.budgetMinor,
    actualMinor: d.actualMinor,
    varianceMinor: d.varianceMinor,
  };
}

export function buildParityTemplate(
  overrides: Partial<Record<ParityClient, Partial<ParityRow>>> = {},
): ParityRow[] {
  const exp = expectedWalkthrough();
  const base = (client: ParityClient): ParityRow => ({
    client,
    status: "not_verified",
    question_es: DEMO_QUESTION_ES,
    expected_actual_minor: exp.actualMinor,
    expected_variance_minor: exp.varianceMinor,
    tool_output_actual_minor: null,
    tool_output_variance_minor: null,
    notes:
      "Paste tool JSON from the client; compare to expected. Do not trust the assistant's prose numbers.",
    ...overrides[client],
  });
  return [base("grok"), base("claude"), base("chatgpt")];
}

/** Score a row once tool minors are filled in. */
export function evaluateParityRow(row: ParityRow): ParityRow {
  if (
    row.tool_output_actual_minor == null ||
    row.tool_output_variance_minor == null
  ) {
    return { ...row, status: "not_verified" };
  }
  const ok =
    row.tool_output_actual_minor === row.expected_actual_minor &&
    row.tool_output_variance_minor === row.expected_variance_minor;
  return {
    ...row,
    status: ok ? "pass" : "fail",
    notes: ok
      ? "Tool output matches golden figures."
      : `Mismatch: tool actual=${row.tool_output_actual_minor} variance=${row.tool_output_variance_minor}`,
  };
}
