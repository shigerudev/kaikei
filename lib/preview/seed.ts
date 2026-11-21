/**
 * Preview workspace seed (owner: Jordi, K7). Hand-written so the SCOPE §5.1 walkthrough works
 * before the DB path lands: Deliveries Nov budget Q3,000, actual Q2,700 (Q1,200 + Q600 + Q900).
 * Uploading public/samples/sample_actuals_nov.csv then yields 1 new / 2 already imported / 1 flagged
 * and Deliveries Q3,300 (+Q300), matching fixtures/golden.json.
 */
export const PREVIEW_WS = "demo";

/** Deterministic UUIDs so routes and the Zod `uuid()` contracts accept preview ids. */
export const uid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

export type SeedCategory = { id: string; name: string; aliases: string[]; kind: "expense" | "income" };

export const CATEGORIES: SeedCategory[] = [
  { id: uid(1), name: "Deliveries", aliases: ["entregas", "delivery", "transporte", "envios"], kind: "expense" },
  { id: uid(2), name: "Rent", aliases: ["renta", "alquiler"], kind: "expense" },
  { id: uid(3), name: "Payroll", aliases: ["planilla", "salarios", "nomina"], kind: "expense" },
  { id: uid(4), name: "Supplies", aliases: ["insumos", "materia prima"], kind: "expense" },
  { id: uid(5), name: "Sales", aliases: ["ventas", "ingresos"], kind: "income" },
];

export const BUDGET_HEADERS = ["periodo", "categoria", "monto", "moneda"];
export const ACTUAL_HEADERS = ["fecha", "descripcion", "categoria", "monto", "moneda"];

/** [period, raw category, amount] — raw budget rows as they'd appear in the owner's spreadsheet. */
export const BUDGET_ROWS: [string, string, string][] = [
  ["2026-10", "Entregas", "2500.00"],
  ["2026-10", "Renta", "4500.00"],
  ["2026-10", "Planilla", "18000.00"],
  ["2026-10", "Insumos", "6000.00"],
  ["2026-10", "Ventas", "30000.00"],
  ["2026-11", "Entregas", "3000.00"],
  ["2026-11", "Renta", "4500.00"],
  ["2026-11", "Planilla", "18000.00"],
  ["2026-11", "Insumos", "6200.00"],
  ["2026-11", "Ventas", "32000.00"],
];

/** [date, description, raw category, amount] — raw bank-export rows. Negative = money out. */
export const ACTUAL_ROWS: [string, string, string, string][] = [
  ["2026-10-01", "Inmobiliaria Las Flores - renta octubre", "Renta", "-4500.00"],
  ["2026-10-03", "Moto Envios - ruta centro", "Entregas", "-1100.00"],
  ["2026-10-08", "Harinas del Sur - harina 40 qq", "Insumos", "-2900.00"],
  ["2026-10-10", "Ventas mostrador semana 41", "Ventas", "14200.00"],
  ["2026-10-15", "Planilla quincena 1", "Planilla", "-9000.00"],
  ["2026-10-21", "Fletes Guate - ruta Mixco", "Entregas", "-1300.00"],
  ["2026-10-24", "Ventas mostrador semana 43", "Ventas", "16100.00"],
  ["2026-10-30", "Planilla quincena 2", "Planilla", "-9000.00"],
  ["2026-11-01", "Inmobiliaria Las Flores - renta noviembre", "Renta", "-4500.00"],
  ["2026-11-02", "Moto Envios - ruta centro", "Entregas", "-1200.00"],
  ["2026-11-05", "Harinas del Sur - harina 45 qq", "Insumos", "-3100.00"],
  ["2026-11-07", "Mensajeria Express - envios zona 10", "Entregas", "-600.00"],
  ["2026-11-10", "Ventas mostrador semana 45", "Ventas", "12800.00"],
  ["2026-11-12", "Fletes Guate - ruta Mixco", "Entregas", "-900.00"],
  ["2026-11-15", "Planilla quincena 1", "Planilla", "-9000.00"],
];

/** Sample extraction used in preview when the uploaded PDF is the fixture bill (AI path stands in). */
export const SAMPLE_EXTRACTIONS: { match: RegExp; supplier: string; date: string; currency: string; totalMinor: bigint }[] = [
  { match: /transportes/i, supplier: "Transportes Rápidos", date: "2026-11-18", currency: "GTQ", totalMinor: 60000n },
  { match: /renta|flores/i, supplier: "Inmobiliaria Las Flores", date: "2026-11-01", currency: "GTQ", totalMinor: 450000n },
  { match: /martillo|ferreter/i, supplier: "Ferretería El Martillo", date: "2026-11-09", currency: "GTQ", totalMinor: 27500n },
];
