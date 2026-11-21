/**
 * K9 MCP bilingual copy for consolidation tools (PIPER-81 / MANIFESTO §4.4.1).
 * Tools are read-only over PUBLISHED runs. Figures come from the engine API only.
 * Wire these into `app/api/mcp/[token]` once Antonio lands PIPER-84 / PIPER-82.
 */

export function bilingual(en: string, es: string, extra?: string): string {
  const parts = [`EN: ${en}`, `ES: ${es}`];
  if (extra) parts.push(extra);
  return parts.join(" ");
}

const PUBLISHED_ONLY =
  "Only published runs / solo corridas PUBLISHED. Never invent amounts; quote engine decimal strings + source refs.";

const DRAFT_REFUSAL =
  "Draft or BLOCKED runs: refuse or label clearly as non-publishable preview. / Corridas DRAFT o BLOCKED: rechaza o etiquétalas como preview no publicable.";

export type ConsolidationToolName =
  | "get_run_status"
  | "get_facts"
  | "get_findings"
  | "get_reconciliations"
  | "get_fact_lineage";

/** Canonical read-only tool set. Mutating names must never appear here. */
export const READONLY_TOOL_NAMES = [
  "get_run_status",
  "get_facts",
  "get_findings",
  "get_reconciliations",
  "get_fact_lineage",
] as const satisfies readonly ConsolidationToolName[];

/** Names that must never be registered on the MCP route. */
export const FORBIDDEN_MUTATING_TOOL_NAMES = [
  "publish",
  "publish_run",
  "upload",
  "upload_file",
  "approve",
  "approve_mapping",
  "decide",
  "decide_finding",
  "create_run",
  "start_run",
  "reset_preview",
] as const;

export type ToolParam = {
  name: string;
  required: boolean;
  description: string;
};

export type ToolCopy = {
  title: string;
  description: string;
  params: ToolParam[];
};

export const CONSOLIDATION_TOOL_COPY: Record<ConsolidationToolName, ToolCopy> = {
  get_run_status: {
    title: "Run status / Estado de la corrida",
    description: bilingual(
      "Status, fingerprint, finding counts and publication badge for a consolidation run.",
      "Estado, fingerprint, conteo de hallazgos y badge de publicación de una corrida.",
      `${PUBLISHED_ONLY} ${DRAFT_REFUSAL}`,
    ),
    params: [
      {
        name: "run_id",
        required: false,
        description: bilingual(
          "Consolidation run id; omit for the latest published (or labelled preview) run.",
          "Id de la corrida; omite para la última publicada (o preview etiquetado).",
        ),
      },
    ],
  },
  get_facts: {
    title: "Consolidated facts / Cifras consolidadas",
    description: bilingual(
      "Consolidated P&L or balance facts for a period (USD decimal strings) from the engine.",
      "Cifras consolidadas de P&L o balance por periodo (strings decimales USD) desde el motor.",
      PUBLISHED_ONLY,
    ),
    params: [
      {
        name: "run_id",
        required: true,
        description: bilingual("Consolidation run id.", "Id de la corrida de consolidación."),
      },
      {
        name: "period",
        required: true,
        description: bilingual(
          "Period key, e.g. 2027-01 or 2027 for FY P&L; use 2027-12 with statement=BS for the balance sheet.",
          "Periodo, p. ej. 2027-01 o 2027 para P&L anual; usa 2027-12 con statement=BS para el balance.",
        ),
      },
      {
        name: "statement",
        required: false,
        description: bilingual(
          "PL (default) or BS.",
          "PL (por defecto) o BS.",
        ),
      },
    ],
  },
  get_findings: {
    title: "Findings / Hallazgos",
    description: bilingual(
      "Validation findings (rule id, severity, source file/row) for a run. Filter by severity or rule.",
      "Hallazgos de validación (regla, severidad, archivo/fila) de una corrida. Filtra por severidad o regla.",
      PUBLISHED_ONLY,
    ),
    params: [
      {
        name: "run_id",
        required: true,
        description: bilingual("Consolidation run id.", "Id de la corrida de consolidación."),
      },
      {
        name: "severity",
        required: false,
        description: bilingual(
          "Optional filter: BLOCKER | WARNING | INFO.",
          "Filtro opcional: BLOCKER | WARNING | INFO.",
        ),
      },
      {
        name: "rule_id",
        required: false,
        description: bilingual(
          "Optional rule id, e.g. VAL-008.",
          "Id de regla opcional, p. ej. VAL-008.",
        ),
      },
    ],
  },
  get_reconciliations: {
    title: "IC reconciliations / Conciliaciones IC",
    description: bilingual(
      "Intercompany matches, mismatches and one-sided pairs after FX, with differences and tolerance.",
      "Pares intercompañía matched/mismatch/one-sided tras FX, con diferencia y tolerancia.",
      PUBLISHED_ONLY,
    ),
    params: [
      {
        name: "run_id",
        required: true,
        description: bilingual("Consolidation run id.", "Id de la corrida de consolidación."),
      },
    ],
  },
  get_fact_lineage: {
    title: "Fact lineage / Linaje de una cifra",
    description: bilingual(
      "Drill one consolidated fact to contributions, FX rate, match, journal and source cell.",
      "Desglosa una cifra consolidada a contribuciones, tipo de cambio, match, asiento y celda fuente.",
      PUBLISHED_ONLY,
    ),
    params: [
      {
        name: "fact_id",
        required: true,
        description: bilingual(
          "Fact id from get_facts (e.g. FACT-PL-2027-01-REV_SALES).",
          "Id del fact desde get_facts (p. ej. FACT-PL-2027-01-REV_SALES).",
        ),
      },
    ],
  },
} as const;

/** Demo prompt for AC15 parity walks (Spanish). */
export const CONSOLIDATION_WALKTHROUGH_ES =
  "Pregunta de demo: ¿Cuál es el revenue consolidado de ene-2027 y de dónde sale? " +
  "Usa get_facts period=2027-01 y luego get_fact_lineage sobre ese fact_id.";

/** English twin for bilingual client logs. */
export const CONSOLIDATION_WALKTHROUGH_EN =
  "Demo question: What is consolidated revenue for Jan 2027 and where does it come from? " +
  "Call get_facts period=2027-01 then get_fact_lineage on that fact_id.";

export function assertNoMutatingTools(registered: readonly string[]): void {
  const forbidden = new Set<string>(FORBIDDEN_MUTATING_TOOL_NAMES);
  const hits = registered.filter((n) => forbidden.has(n) || /^(create|update|delete|post|put|patch)/i.test(n));
  if (hits.length) {
    throw new Error(`Mutating MCP tools must not be registered: ${hits.join(", ")}`);
  }
  for (const name of READONLY_TOOL_NAMES) {
    if (!registered.includes(name)) {
      throw new Error(`Missing required read-only MCP tool: ${name}`);
    }
  }
}
