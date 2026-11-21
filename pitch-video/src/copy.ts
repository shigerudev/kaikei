// All on-screen copy. Facts come from fixtures/grupo-ag (answer_key_errors.csv, tasas_grupo.csv,
// entidades.csv) and severities from docs/MANIFESTO.md §4.3. Nothing here is a consolidated total.
export type Lang = "en" | "es";

export const FILES = [
  { name: "01_AG_Distribucion_GT.csv", ccy: "GTQ", trap: "ene-2027" },
  { name: "02_AG_Manufactura_GT.csv", ccy: "GTQ", trap: "wide + subtotals" },
  { name: "03_AG_ElSalvador.csv", ccy: "USD", trap: "YYYY-MM" },
  { name: "04_AG_Panama.csv", ccy: "USD", trap: '"(14,000.00)"' },
  { name: "05_AG_Espana.csv", ccy: "EUR", trap: "1.234,56 ;" },
  { name: "06_AG_Holding.csv", ccy: "USD", trap: "Debit / Credit" },
];

export const SNIPPETS = [
  "Periodo;Cuenta;Importe",
  "ene-2027",
  "1.234,56",
  '"(14,000.00)"',
  "Debit | Credit",
  "31-Dec-2027",
  "Total costos y gastos",
  "7,70 GTQ/USD",
  "2027-08",
  "9.9.99 Otros varios",
  "AGM-GT",
  "AG HOLDING",
];

type Sev = "BLOCKER" | "WARNING" | "INFO";
export type FindingRow = { id: string; rule: string; sev: Sev; en: string; es: string };
export const FINDINGS: FindingRow[] = [
  { id: "E01", rule: "VAL-006", sev: "WARNING", en: "Duplicate row", es: "Fila duplicada" },
  { id: "E02", rule: "VAL-008", sev: "WARNING", en: "Intercompany mismatch", es: "Diferencia intercompañía" },
  { id: "E03", rule: "VAL-010", sev: "BLOCKER", en: "Subtotal ≠ components", es: "Subtotal ≠ componentes" },
  { id: "E04", rule: "VAL-019", sev: "WARNING", en: "Negative revenue", es: "Ventas negativas" },
  { id: "E05", rule: "VAL-020", sev: "WARNING", en: "Missing month", es: "Mes faltante" },
  { id: "E06", rule: "VAL-021", sev: "BLOCKER", en: "Wrong currency", es: "Moneda equivocada" },
  { id: "E07", rule: "VAL-003", sev: "BLOCKER", en: "Unmapped account", es: "Cuenta sin mapear" },
  { id: "E08", rule: "VAL-007", sev: "WARNING", en: "One-sided intercompany", es: "Intercompañía de un lado" },
  { id: "E09", rule: "VAL-022", sev: "WARNING", en: "Locale mismatch", es: "Formato numérico" },
  { id: "E10", rule: "VAL-023", sev: "BLOCKER", en: "Balance doesn't balance", es: "Balance no cuadra" },
  { id: "E11a", rule: "VAL-024", sev: "INFO", en: "Local FX conflict", es: "Tipo de cambio local" },
  { id: "E11b", rule: "VAL-024", sev: "INFO", en: "Local FX conflict", es: "Tipo de cambio local" },
  { id: "E11c", rule: "VAL-024", sev: "INFO", en: "Local FX conflict", es: "Tipo de cambio local" },
];

const en = {
  line: "line",
  hook: { kicker: "Grupo AG · 2027 budget", lines: ["Six companies.", "Six budgets.", "Three currencies."] },
  chaos: {
    title: "None of them look alike.",
    sub: "Merge them by hand and you get double counting, silent errors and a number nobody can defend.",
  },
  reveal: { line: "From six isolated budgets to one consolidated, explainable result." },
  pipeline: {
    kicker: "The engine calculates",
    title: "Deterministic, auditable, layer by layer.",
    stages: [
      ["Source", "original + SHA-256"],
      ["Canonical", "group accounts"],
      ["Translated", "group rates → USD"],
      ["Match", "intercompany pairs"],
      ["Adjustment", "balanced journals"],
      ["Consolidated", "immutable run"],
    ],
    foot: "Exact decimals · originals never edited · every value keeps its cell",
  },
  findings: {
    kicker: "Validation",
    title: "Every planted error, caught before it reaches a total.",
    caught: "planted errors found",
    fp: "false positives",
    spotTitle: "E02 · Purchases from AG Manufactura · Mar 2027",
    buyer: "AG Distribución books",
    seller: "AG Manufactura books",
    note: "Transposed digits. Flagged, never eliminated silently.",
  },
  fx: {
    kicker: "One rate table",
    title: "Local rates get reported. Group rates get used.",
    file: "File says",
    group: "Group rate",
    foot: "2027 average for P&L · 2027-12-31 closing for balance · a missing rate blocks the run",
  },
  elim: {
    kicker: "Intercompany",
    title: "An internal sale is not new group revenue.",
    flow: "Management fee · USD 15,000 / month",
    journal: "Elimination journal",
    dr: "Dr  Management fee income",
    cr: "Cr  Management fee expense",
    balanced: "Balanced",
    e08: "December: AG Panamá has no matching expense → E08, not eliminated.",
  },
  inspector: {
    kicker: "Inspector",
    title: "Click any number. Land on the cell.",
    chain: [
      ["Group advertising", "Sep 2027 · USD"],
      ["Contribution", "AG España · EUR 11,400.00"],
      ["FX rate", "1.08 USD/EUR · 2027 avg"],
      ["Finding", "E09 · VAL-022 · parsed by locale"],
      ["Source cell", "05_AG_Espana.csv · line 80"],
    ],
    raw: "raw value",
    naive: "A naive parser reads 1,140,000.",
  },
  confidence: {
    kicker: "Reproducible",
    title: "Same inputs. Same answer.",
    run: "Run",
    identical: "identical fingerprint",
    published: "PUBLISHED",
    mcpTitle: "Ask your AI assistant. Get the same number.",
    q: "What did AG España budget for advertising in Sep 2027?",
    a: "EUR 11,400.00 → USD 12,312.00 at 1.08 (2027 avg). Published run · source 05_AG_Espana.csv, line 80.",
    mcp: "Read-only MCP · published runs only · AI never invents a figure",
  },
  close: {
    line: "Six budgets. One group figure you can defend.",
    sub: "会計 · accounting",
  },
};

const es: typeof en = {
  line: "línea",
  hook: { kicker: "Grupo AG · presupuesto 2027", lines: ["Seis empresas.", "Seis presupuestos.", "Tres monedas."] },
  chaos: {
    title: "Ninguno se parece al otro.",
    sub: "Si los juntas a mano: doble conteo, errores silenciosos y una cifra que nadie puede defender.",
  },
  reveal: { line: "De seis presupuestos aislados a un resultado consolidado y explicable." },
  pipeline: {
    kicker: "El motor calcula",
    title: "Determinista, auditable, capa por capa.",
    stages: [
      ["Origen", "original + SHA-256"],
      ["Canónico", "cuentas de grupo"],
      ["Convertido", "tipos de grupo → USD"],
      ["Conciliación", "pares intercompañía"],
      ["Ajuste", "asientos cuadrados"],
      ["Consolidado", "run inmutable"],
    ],
    foot: "Decimales exactos · originales intactos · cada valor conserva su celda",
  },
  findings: {
    kicker: "Validación",
    title: "Cada error sembrado, detectado antes de llegar a un total.",
    caught: "errores sembrados detectados",
    fp: "falsos positivos",
    spotTitle: "E02 · Compras a AG Manufactura · mar-2027",
    buyer: "AG Distribución registra",
    seller: "AG Manufactura registra",
    note: "Dígitos transpuestos. Se marca, nunca se elimina en silencio.",
  },
  fx: {
    kicker: "Una tabla de tipos",
    title: "El tipo local se reporta. El tipo del grupo se usa.",
    file: "El archivo dice",
    group: "Tipo del grupo",
    foot: "Promedio 2027 para resultados · cierre 2027-12-31 para balance · sin tipo, el run se bloquea",
  },
  elim: {
    kicker: "Intercompañía",
    title: "Una venta interna no es ingreso nuevo del grupo.",
    flow: "Management fee · USD 15,000 / mes",
    journal: "Asiento de eliminación",
    dr: "Db  Ingreso por management fee",
    cr: "Cr  Gasto por management fee",
    balanced: "Cuadrado",
    e08: "Diciembre: AG Panamá no registra el gasto → E08, no se elimina.",
  },
  inspector: {
    kicker: "Inspector",
    title: "Haz clic en una cifra. Llega a la celda.",
    chain: [
      ["Publicidad del grupo", "sep-2027 · USD"],
      ["Contribución", "AG España · EUR 11.400,00"],
      ["Tipo de cambio", "1,08 USD/EUR · prom. 2027"],
      ["Hallazgo", "E09 · VAL-022 · leído por locale"],
      ["Celda de origen", "05_AG_Espana.csv · línea 80"],
    ],
    raw: "valor original",
    naive: "Un parser ingenuo lee 1.140.000.",
  },
  confidence: {
    kicker: "Reproducible",
    title: "Mismos datos. Misma respuesta.",
    run: "Run",
    identical: "huella idéntica",
    published: "PUBLICADO",
    mcpTitle: "Pregúntale a tu asistente. Obtén la misma cifra.",
    q: "¿Cuánto presupuestó AG España en publicidad en sep-2027?",
    a: "EUR 11.400,00 → USD 12.312,00 a 1,08 (prom. 2027). Run publicado · origen 05_AG_Espana.csv, línea 80.",
    mcp: "MCP de solo lectura · solo runs publicados · la IA nunca inventa una cifra",
  },
  close: {
    line: "Seis presupuestos. Una cifra de grupo que puedes defender.",
    sub: "会計 · contabilidad",
  },
};

export const COPY = { en, es };
export type Copy = typeof en;
