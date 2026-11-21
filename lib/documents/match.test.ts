import { describe, expect, it } from "vitest";
import { scoreMatch } from "./match";

describe("scoreMatch", () => {
  const doc = {
    id: "11111111-1111-4111-8111-111111111111",
    supplier: "Transportes Rápidos",
    docDate: "2026-11-18",
    currency: "GTQ",
    totalMinor: 60000n,
  };

  it("scores exact amount + date + supplier as top suggestion", () => {
    const m = scoreMatch(doc, {
      id: "22222222-2222-4222-8222-222222222222",
      date: "2026-11-18",
      amountMinor: -60000n,
      currency: "GTQ",
      description: "Pago Transportes Rapidos entrega",
      counterparty: null,
    });
    expect(m).not.toBeNull();
    expect(m!.reasons).toContain("amount_exact");
    expect(m!.reasons).toContain("date_within_3d");
    expect(m!.reasons).toContain("supplier_in_description");
    expect(m!.score).toBeGreaterThanOrEqual(0.6);
  });

  it("rejects currency mismatch", () => {
    const m = scoreMatch(doc, {
      id: "22222222-2222-4222-8222-222222222222",
      date: "2026-11-18",
      amountMinor: -60000n,
      currency: "USD",
      description: "Transportes",
      counterparty: null,
    });
    expect(m).toBeNull();
  });
});

