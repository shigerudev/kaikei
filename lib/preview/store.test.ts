import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const store = await import("./store");
const golden = JSON.parse(readFileSync("fixtures/golden.json", "utf8"));

const deliveries = (period = "2026-11") => store.variance(period, "Deliveries")!;

describe("preview store walkthrough (SCOPE §5.1)", () => {
  beforeEach(() => store.resetPreview());

  it("seed matches golden", () => {
    const v = deliveries();
    expect(v.budgetMinor).toBe(golden.seed.deliveries.budgetMinor);
    expect(v.actualMinor).toBe(golden.seed.deliveries.actualMinor);
    expect(v.varianceMinor).toBe(golden.seed.deliveries.varianceMinor);
  });

  it("actuals upload → 1 new / 2 repeat / 1 flagged and Q3,300 (+Q300)", async () => {
    const csv = readFileSync("public/samples/sample_actuals_nov.csv", "utf8");
    const p = await store.proposeImport("sample_actuals_nov.csv", csv);
    expect(p.alreadyImported).toBe(false);
    expect(p.proposal.type).toBe("actual");
    const r = store.applyImport(p.importId, p.proposal);
    expect(r.counts).toEqual(golden.afterUpload.importSummary);
    const v = deliveries();
    expect(v.actualMinor).toBe(golden.afterUpload.deliveries.actualMinor);
    expect(v.varianceMinor).toBe(golden.afterUpload.deliveries.varianceMinor);
    expect(v.contributors).toHaveLength(golden.afterUpload.deliveries.contributors);
    expect(r.changed.deltas.some((d) => d.category === "Deliveries" && d.field === "actual")).toBe(true);
    const flag = store.flags("open").find((f) => f.rule === "parse_error")!;
    expect(flag.rowNumber).toBe(5);
    expect(flag.column).toBe("monto");

    const again = await store.proposeImport("sample_actuals_nov.csv", csv);
    expect(again.alreadyImported).toBe(true);
  });

  it("bill adds evidence, never amount", async () => {
    const csv = readFileSync("public/samples/sample_actuals_nov.csv", "utf8");
    const p = await store.proposeImport("a.csv", csv);
    store.applyImport(p.importId, p.proposal);
    const pdf = readFileSync("public/samples/bill_transportes_rapidos.pdf");
    const { documentId } = await store.uploadDocument("bill_transportes_rapidos.pdf", pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer, false);
    const doc = store.document(documentId)!;
    expect(doc.totalMinor).toBe("60000");
    const top = doc.candidates[0]!;
    expect(top.date).toBe("2026-11-18");
    store.confirmMatch(documentId, top.transactionId);
    expect(store.transaction(top.transactionId)!.hasEvidence).toBe(true);
    expect(deliveries().actualMinor).toBe(golden.bill.deliveriesActualAfterConfirmMinor);
  });

  it("parseAmount edge cases", () => {
    expect(store.parseAmount("1,200.00")).toBe(120000n);
    expect(store.parseAmount("1.200,00")).toBe(120000n);
    expect(store.parseAmount("Q 600")).toBe(60000n);
    expect(store.parseAmount("(600)")).toBe(-60000n);
    expect(store.parseAmount("600-")).toBe(-60000n);
    expect(store.parseAmount("-600.00")).toBe(-60000n);
    expect(store.parseAmount("Q 1,2O0")).toBeNull();
    expect(store.parseAmount("")).toBeNull();
  });
});
