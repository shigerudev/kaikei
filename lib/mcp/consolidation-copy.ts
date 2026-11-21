/**
 * K9 MCP bilingual copy for consolidation tools (PIPER-81 / MANIFESTO §4.4.1).
 * Tools are read-only over PUBLISHED runs. Figures come from the engine API only.
 * Wire these into the MCP route once Antonio lands PIPER-82.
 */

export function bilingual(en: string, es: string, extra?: string): string {
  const parts = [`EN: ${en}`, `ES: ${es}`];
  if (extra) parts.push(extra);
  return parts.join(" ");
}

const PUBLISHED_ONLY =
  "Only published runs / solo corridas PUBLISHED. Never invent amounts; quote engine decimal strings + source refs.";

export const CONSOLIDATION_TOOL_COPY = {
  get_run_status: {
    title: "Run status / Estado de la corrida",
    description: bilingual(
      "Status, fingerprint, finding counts and publication badge for a consolidation run.",
      "Estado, fingerprint, conteo de hallazgos y badge de publicación de una corrida.",
      PUBLISHED_ONLY,
    ),
  },
  get_facts: {
    title: "Consolidated facts / Cifras consolidadas",
    description: bilingual(
      "Consolidated P&L or balance facts for a period (USD decimal strings) from the engine.",
      "Cifras consolidadas de P&L o balance por periodo (strings decimales USD) desde el motor.",
      PUBLISHED_ONLY,
    ),
  },
  get_findings: {
    title: "Findings / Hallazgos",
    description: bilingual(
      "Validation findings (rule id, severity, source file/row) for a run. Filter by severity or rule.",
      "Hallazgos de validación (regla, severidad, archivo/fila) de una corrida. Filtra por severidad o regla.",
      PUBLISHED_ONLY,
    ),
  },
  get_reconciliations: {
    title: "IC reconciliations / Conciliaciones IC",
    description: bilingual(
      "Intercompany matches, mismatches and one-sided pairs after FX, with differences and tolerance.",
      "Pares intercompañía matched/mismatch/one-sided tras FX, con diferencia y tolerancia.",
      PUBLISHED_ONLY,
    ),
  },
  get_fact_lineage: {
    title: "Fact lineage / Linaje de una cifra",
    description: bilingual(
      "Drill one consolidated fact to contributions, FX rate, match, journal and source cell.",
      "Desglosa una cifra consolidada a contribuciones, tipo de cambio, match, asiento y celda fuente.",
      PUBLISHED_ONLY,
    ),
  },
} as const;

/** Demo prompt for AC15 parity walks. */
export const CONSOLIDATION_WALKTHROUGH_ES =
  "Pregunta de demo: ¿Cuál es el revenue consolidado de ene-2027 y de dónde sale? " +
  "Usa get_facts period=2027-01 y luego get_fact_lineage sobre ese fact_id.";
