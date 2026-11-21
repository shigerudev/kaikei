/**
 * ES/EN header synonym table (owner: Hugo). Heuristics first; LLM only for leftovers.
 */
import type { MappingField } from "@/lib/types";

/** Normalized header token → canonical field. */
export const HEADER_SYNONYMS: Record<string, MappingField> = {
  // date
  fecha: "date",
  date: "date",
  fch: "date",
  dia: "date",
  day: "date",
  // period
  periodo: "period",
  period: "period",
  mes: "period",
  month: "period",
  // category
  rubro: "category",
  categoria: "category",
  categoría: "category",
  category: "category",
  account: "category",
  cuenta: "category",
  // amount
  monto: "amount",
  "monto (q)": "amount",
  amount: "amount",
  importe: "amount",
  valor: "amount",
  total: "amount",
  // currency
  moneda: "currency",
  currency: "currency",
  divisa: "currency",
  // description
  concepto: "description",
  description: "description",
  descripcion: "description",
  descripción: "description",
  detalle: "description",
  memo: "description",
  // counterparty / supplier
  proveedor: "counterparty",
  supplier: "counterparty",
  counterparty: "counterparty",
  tercero: "counterparty",
  cliente: "counterparty",
  vendor: "counterparty",
};

/** Category aliases → canonical workspace name (seed: Deliveries). */
export const CATEGORY_ALIASES: Record<string, string> = {
  entregas: "Deliveries",
  deliveries: "Deliveries",
  delivery: "Deliveries",
  transporte: "Deliveries",
  transport: "Deliveries",
};

export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function fieldForHeader(header: string): MappingField | null {
  const key = normalizeHeader(header);
  return HEADER_SYNONYMS[key] ?? null;
}
