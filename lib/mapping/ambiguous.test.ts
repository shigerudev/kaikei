import { describe, expect, it } from "vitest";
import { proposeByHeuristics } from "./index";

describe("ambiguous columns require owner choice", () => {
  it("lists candidates when two headers map to the same field", () => {
    const proposal = proposeByHeuristics({
      workspaceId: "ws",
      importId: "imp",
      headers: ["Fecha", "Date", "Monto", "Amount"],
      sampleRows: [
        { Fecha: "2026-11-01", Date: "2026-11-01", Monto: "10", Amount: "10" },
      ],
    });
    expect(proposal.ambiguous.some((a) => a.field === "date")).toBe(true);
    expect(proposal.ambiguous.some((a) => a.field === "amount")).toBe(true);
    expect(proposal.fields.date).toBeUndefined();
    expect(proposal.fields.amount).toBeUndefined();
  });
});
