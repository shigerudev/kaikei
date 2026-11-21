import { describe, expect, it } from "vitest";
import { proposeByHeuristics } from "./index";

describe("proposeByHeuristics", () => {
  it("maps sample ES headers without LLM", () => {
    const proposal = proposeByHeuristics({
      workspaceId: "ws",
      importId: "imp",
      headers: ["Fecha", "Concepto", "Rubro", "Monto (Q)"],
      sampleRows: [
        {
          Fecha: "2026-11-18",
          Concepto: "Transportes Rápidos",
          Rubro: "entregas",
          "Monto (Q)": "600.00",
        },
      ],
    });

    expect(proposal.type).toBe("actual");
    expect(proposal.fields.date?.column).toBe("Fecha");
    expect(proposal.fields.description?.column).toBe("Concepto");
    expect(proposal.fields.category?.column).toBe("Rubro");
    expect(proposal.fields.amount?.column).toBe("Monto (Q)");
    expect(proposal.ambiguous).toEqual([]);
  });

  it("guesses budget when only period is present", () => {
    const proposal = proposeByHeuristics({
      workspaceId: "ws",
      importId: "imp",
      headers: ["Periodo", "Rubro", "Monto"],
      sampleRows: [{ Periodo: "2026-12", Rubro: "Deliveries", Monto: "3000" }],
    });
    expect(proposal.type).toBe("budget");
  });
});
