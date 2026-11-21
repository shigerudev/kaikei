/**
 * Bilingual MCP tool copy (owner: Hugo). AC9 / MANIFESTO §4.4.
 * Keep EN + ES in every description and list category aliases so assistants
 * resolve "entregas" → Deliveries without inventing figures.
 */

export const CATEGORY_ALIAS_HINT =
  "Category aliases / alias de rubro: entregas|delivery|transporte → Deliveries. " +
  "Always call tools for numbers; never invent amounts.";

export const WALKTHROUGH_ES =
  "Pregunta de demo (ES): ¿Por qué Deliveries está Q300 sobre presupuesto en noviembre? " +
  "Usa get_budget_variance con category=Deliveries (o entregas) y period=2026-11.";

export function bilingual(en: string, es: string, extra?: string): string {
  const parts = [`EN: ${en}`, `ES: ${es}`, CATEGORY_ALIAS_HINT];
  if (extra) parts.push(extra);
  return parts.join(" ");
}

export const TOOL_COPY = {
  get_overview: {
    title: "Overview / Resumen",
    description: bilingual(
      "Budget, actual and variance per category for a period, plus cash in/out and open review flags. Returns as_of.",
      "Presupuesto, real y variación por rubro para un periodo, más entradas/salidas de efectivo y alertas abiertas. Incluye as_of.",
      WALKTHROUGH_ES,
    ),
  },
  get_budget_variance: {
    title: "Budget variance / Variación vs presupuesto",
    description: bilingual(
      "Budget vs actual for one category with contributing transactions (latest first) and source refs.",
      "Presupuesto vs real de un rubro, con las transacciones que lo componen y sus comprobantes.",
      WALKTHROUGH_ES,
    ),
  },
  search_transactions: {
    title: "Search transactions / Buscar transacciones",
    description: bilingual(
      "Find transactions by text, category, period or whether a bill is attached.",
      "Busca transacciones por texto, rubro, periodo o si tienen comprobante.",
    ),
  },
  get_transaction: {
    title: "Transaction / Transacción",
    description: bilingual(
      "One transaction with its original CSV row and linked bills (deep links).",
      "Una transacción con su fila CSV original y comprobantes vinculados (enlaces profundos).",
    ),
  },
  get_document: {
    title: "Document / Documento",
    description: bilingual(
      "Extracted bill fields, the PDF link and the linked transaction.",
      "Datos extraídos de la factura, enlace al PDF y transacción vinculada.",
    ),
  },
  list_review_flags: {
    title: "Review flags / Alertas por revisar",
    description: bilingual(
      "Flags with their location (file, row, column) and reason.",
      "Alertas con su ubicación (archivo, fila, columna) y motivo.",
    ),
  },
  what_changed: {
    title: "What changed / Qué cambió",
    description: bilingual(
      "Per-figure deltas (before → after) from the latest or a given import.",
      "Cambios por cifra (antes → después) de la última importación o de una específica.",
    ),
  },
} as const;
