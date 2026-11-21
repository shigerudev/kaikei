/**
 * Integrity check for the Grupo AG consolidation fixtures (fixtures/grupo-ag/).
 * Usage: npm run fixtures:check
 *
 * This is NOT the engine. It parses each of the six formats with hard-coded, per-file rules
 * and asserts two things:
 *   1. every planted error in answer_key_errors.csv is present at the stated location;
 *   2. nothing else is wrong (months complete, balance sheets balance, intercompany pairs
 *      reconcile in budget AND 2026 actual, mapping key covers every account).
 * If someone edits a fixture and adds an unplanted defect or removes a planted one, this fails.
 * Money is bigint minor units throughout (2 decimals for GTQ / USD / EUR).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "fixtures", "grupo-ag");
const read = (f: string) => readFileSync(join(DIR, f), "utf8").replace(/\r\n/g, "\n");

// ---------- primitives ----------

/** Minimal RFC 4180 line splitter (quoted fields, doubled quotes). */
function splitCsv(line: string, sep = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      out.push(cur);
      cur = "";
    }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Decimal string → minor units (2 dp). Explicit separators; "(x)" means negative. */
function minor(raw: string, dec: "." | "," = "."): bigint {
  let s = raw.trim();
  let neg = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  const thou = dec === "." ? "," : ".";
  s = s.split(thou).join("");
  const [int, frac = ""] = s.split(dec);
  if (!/^\d+$/.test(int) || !/^\d{0,2}$/.test(frac)) throw new Error(`bad amount "${raw}"`);
  const v = BigInt(int) * 100n + BigInt(frac.padEnd(2, "0"));
  return neg ? -v : v;
}

type Rec = {
  entity: string;
  line: number;
  account: string;
  month: number | null; // 1..12 for budget P&L, null otherwise
  scenario: "budget" | "actual" | "balance";
  currency: string;
  /** Natural sign: revenue, expense, asset, liability, equity all positive. */
  amount: bigint;
};

const recs: Rec[] = [];
const notes: { entity: string; line: number; text: string }[] = [];
const subtotalIssues: { line: number; col: string }[] = [];
const formatIssues: { entity: string; line: number }[] = [];

// ---------- loaders (one per format) ----------

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// EMP1: long, comma, "ene-2027", Escenario Presupuesto / Real / Balance, trailing note row.
read("01_AG_Distribucion_GT.csv")
  .split("\n")
  .forEach((l, i) => {
    if (i === 0 || !l) return;
    const [mes, cuenta, desc, monto, esc] = splitCsv(l);
    if (mes === "Nota") return notes.push({ entity: "EMP1", line: i + 1, text: desc });
    const scenario = esc === "Presupuesto" ? "budget" : esc === "Real" ? "actual" : "balance";
    recs.push({
      entity: "EMP1",
      line: i + 1,
      account: cuenta,
      month: scenario === "budget" ? MES.indexOf(mes.slice(0, 3)) + 1 : null,
      scenario,
      currency: "GTQ",
      amount: minor(monto),
    });
  });

// EMP2: wide budget block (lines 1-19), then Balance block, then Real 2026 block.
{
  const lines = read("02_AG_Manufactura_GT.csv").split("\n");
  const cols = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  let block: "budget" | "balance" | "actual" = "budget";
  const grid = new Map<string, { line: number; v: bigint[]; total: bigint }>();
  lines.forEach((l, i) => {
    const f = splitCsv(l);
    const a = f[0]?.trim();
    if (!a) return;
    if (a === "Rubro") return void (block = "balance");
    if (a === "Concepto" && i > 0 && f[1]?.startsWith("Real")) return void (block = "actual");
    if (a === "Concepto" || a === a.toUpperCase()) return; // header / section header
    if (a.startsWith("Nota")) return notes.push({ entity: "EMP2", line: i + 1, text: a });
    if (block === "budget") {
      const v = f.slice(1, 13).map((x) => minor(x));
      const total = minor(f[13]);
      grid.set(a, { line: i + 1, v, total });
      if (v.reduce((s, x) => s + x, 0n) !== total) subtotalIssues.push({ line: i + 1, col: "Total" });
      if (a.startsWith("Total") || a.startsWith("Utilidad")) return; // derived rows
      v.forEach((amount, m) =>
        recs.push({ entity: "EMP2", line: i + 1, account: a, month: m + 1, scenario: "budget", currency: "GTQ", amount }),
      );
    } else {
      recs.push({ entity: "EMP2", line: i + 1, account: a, month: null, scenario: block, currency: "GTQ", amount: minor(f[1]) });
    }
  });
  const sum = (names: string[], m: number) => names.reduce((s, n) => s + grid.get(n)!.v[m], 0n);
  const costs = ["Materia prima", "Mano de obra directa", "Energía y mantenimiento", "Sueldos administrativos", "Depreciación maquinaria", "Otros gastos", "Intereses"];
  const income = ["Ventas a terceros", "Ventas a AG Distribución", "Ventas a AG El Salvador"];
  cols.forEach((c, m) => {
    if (sum(income, m) !== grid.get("Total ingresos")!.v[m]) subtotalIssues.push({ line: grid.get("Total ingresos")!.line, col: c });
    if (sum(costs, m) !== grid.get("Total costos y gastos")!.v[m]) subtotalIssues.push({ line: grid.get("Total costos y gastos")!.line, col: c });
  });
}

// EMP3: long, comma, dot decimal, YYYY-MM, P&L + balance.
read("03_AG_ElSalvador.csv")
  .split("\n")
  .forEach((l, i) => {
    if (i === 0 || !l) return;
    const [periodo, codigo, , tipo, moneda, valor, , esc] = splitCsv(l);
    const scenario = tipo === "balance" ? "balance" : esc === "real" ? "actual" : "budget";
    recs.push({
      entity: "EMP3",
      line: i + 1,
      account: codigo,
      month: scenario === "budget" ? Number(periodo.slice(5)) : null,
      scenario,
      currency: moneda,
      amount: minor(valor),
    });
  });

// EMP4: amounts as text with thousands separators, expenses in parentheses, dd/mm/yyyy.
read("04_AG_Panama.csv")
  .split("\n")
  .forEach((l, i) => {
    if (i === 0 || !l) return;
    const [fecha, codigo, , moneda, importe, , tipo] = splitCsv(l);
    const scenario = tipo === "Presupuesto" ? "budget" : tipo === "Balance" ? "balance" : "actual";
    const raw = minor(importe);
    recs.push({
      entity: "EMP4",
      line: i + 1,
      account: codigo,
      month: scenario === "budget" ? Number(fecha.slice(3, 5)) : null,
      scenario,
      currency: moneda,
      amount: raw < 0n ? -raw : raw, // parentheses mark expenses → natural sign
    });
  });

// EMP5: 2 preamble lines, semicolon, decimal comma.
read("05_AG_Espana.csv")
  .split("\n")
  .forEach((l, i) => {
    if (!l) return;
    if (l.startsWith("#")) return notes.push({ entity: "EMP5", line: i + 1, text: l });
    if (i === 2) return; // header
    const [, mes, cuenta, , importe, esc] = splitCsv(l, ";");
    if (!importe.includes(",")) formatIssues.push({ entity: "EMP5", line: i + 1 });
    const scenario = esc === "Presupuesto" ? "budget" : esc === "Real" ? "actual" : "balance";
    recs.push({
      entity: "EMP5",
      line: i + 1,
      account: cuenta,
      month: scenario === "budget" ? Number(mes) : null,
      scenario,
      currency: "EUR",
      // locale-correct reading: a dot-decimal value in this file is still a decimal
      amount: importe.includes(",") ? minor(importe, ",") : minor(importe, "."),
    });
  });

// EMP6: Debit / Credit columns, dd-Mon-yyyy.
{
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  read("06_AG_Holding.csv")
    .split("\n")
    .forEach((l, i) => {
      if (i === 0 || !l) return;
      const [month, acct, , dr, cr, , type] = splitCsv(l);
      const scenario = type === "Budget" ? "budget" : type === "Actual" ? "actual" : "balance";
      recs.push({
        entity: "EMP6",
        line: i + 1,
        account: acct,
        month: scenario === "budget" ? MON.indexOf(month.slice(3, 6)) + 1 : null,
        scenario,
        currency: "USD",
        amount: dr ? minor(dr) : minor(cr),
      });
    });
}

// ---------- reference data ----------

const ENTITY_CCY: Record<string, string> = {};
read("entidades.csv")
  .split("\n")
  .slice(1)
  .filter(Boolean)
  .forEach((l) => {
    const f = splitCsv(l);
    ENTITY_CCY[f[0]] = f[3];
  });

const mapping = new Map<string, { group: string; type: string }>();
read("answer_key_mapping.csv")
  .split("\n")
  .slice(1)
  .filter(Boolean)
  .forEach((l) => {
    const [entity, local, , group, type] = splitCsv(l);
    mapping.set(`${entity}|${local}`, { group, type });
  });

// ---------- detectors ----------

type Found = { type: string; entity: string; where: string };
const found: Found[] = [];
const push = (type: string, entity: string, where: string) => found.push({ type, entity, where });

// duplicate rows (same entity / account / month / amount in budget)
{
  const seen = new Map<string, Rec>();
  for (const r of recs.filter((r) => r.scenario === "budget")) {
    const k = `${r.entity}|${r.account}|${r.month}`;
    if (seen.has(k)) push("duplicate_row", r.entity, `line ${r.line}`);
    else seen.set(k, r);
  }
}
// subtotal mismatches
subtotalIssues.forEach((s) => push("subtotal_mismatch", "EMP2", `line ${s.line}, column ${s.col}`));
// reversed sign (natural-sign model: nothing should be negative)
recs.filter((r) => r.amount < 0n).forEach((r) => push("sign_error", r.entity, `line ${r.line}`));
// missing months (budget P&L accounts must have 12 months)
{
  const months = new Map<string, Set<number>>();
  for (const r of recs.filter((r) => r.scenario === "budget")) {
    const k = `${r.entity}|${r.account}`;
    if (!months.has(k)) months.set(k, new Set());
    months.get(k)!.add(r.month!);
  }
  for (const [k, ms] of months) {
    const [entity, account] = k.split("|");
    if (ms.size === 1) continue; // one-off line (e.g. unmapped 9.9.99) → not a series
    for (let m = 1; m <= 12; m++) if (!ms.has(m)) push("missing_period", entity, `${account} month ${m}`);
  }
}
// wrong currency for entity
recs.filter((r) => r.currency !== ENTITY_CCY[r.entity]).forEach((r) => push("wrong_currency", r.entity, `line ${r.line}`));
// unmapped accounts
{
  const reported = new Set<string>();
  for (const r of recs) {
    const k = `${r.entity}|${r.account}`;
    if (!mapping.has(k) && !reported.has(k)) {
      reported.add(k);
      push("unmapped_account", r.entity, `line ${r.line}`);
    }
  }
}
// number-format / locale mismatch
formatIssues.forEach((f) => push("number_format", f.entity, `line ${f.line}`));
// balance sheets
for (const e of Object.keys(ENTITY_CCY)) {
  let assets = 0n;
  let le = 0n;
  for (const r of recs.filter((r) => r.entity === e && r.scenario === "balance")) {
    const t = mapping.get(`${e}|${r.account}`)?.type;
    if (t === "BS_ASSET") assets += r.amount;
    else if (t === "BS_LIAB" || t === "BS_EQUITY") le += r.amount;
    else throw new Error(`${e} balance account ${r.account} has no BS type in mapping key`);
  }
  if (assets === 0n) throw new Error(`${e} has no balance sheet`);
  if (assets !== le) push("balance_not_balanced", e, `assets ${assets} vs L+E ${le}`);
}
// local FX notes that conflict with the group table
notes.filter((n) => /tasa|tipo de cambio/i.test(n.text)).forEach((n) => push("fx_assumption_conflict", n.entity, `line ${n.line}`));

// intercompany: each pair reconciles in budget (per month) and in 2026 actual (annual)
{
  const get = (entity: string, account: string, scenario: Rec["scenario"], month: number | null) =>
    recs.filter((r) => r.entity === entity && r.account === account && r.scenario === scenario && r.month === month).reduce((s, r) => s + r.amount, 0n);
  // [seller entity, seller account, buyer entity, buyer account, seller→buyer FX as [num, den] per year]
  type Pair = [string, string, string, string, Record<"budget" | "actual", [bigint, bigint]>];
  const same: Record<"budget" | "actual", [bigint, bigint]> = { budget: [1n, 1n], actual: [1n, 1n] };
  const usdToGtq: Record<"budget" | "actual", [bigint, bigint]> = { budget: [775n, 100n], actual: [780n, 100n] };
  const gtqToUsd: Record<"budget" | "actual", [bigint, bigint]> = { budget: [100n, 775n], actual: [100n, 780n] };
  const usdToEur: Record<"budget" | "actual", [bigint, bigint]> = { budget: [100n, 108n], actual: [100n, 106n] };
  const pairs: Pair[] = [
    ["EMP2", "Ventas a AG Distribución", "EMP1", "5102", same],
    ["EMP2", "Ventas a AG El Salvador", "EMP3", "50-02", gtqToUsd],
    ["EMP6", "R100", "EMP1", "6601", usdToGtq],
    ["EMP6", "R101", "EMP3", "60-05", same],
    ["EMP6", "R102", "EMP4", "6.1.05", same],
    ["EMP6", "R103", "EMP5", "623", usdToEur],
    ["EMP6", "R200", "EMP4", "7.1.01", same],
  ];
  const TOL = 100n; // 1.00 in buyer currency (EUR fee 13,888.89 rounds)
  for (const [se, sa, be, ba, fx] of pairs) {
    for (const scenario of ["budget", "actual"] as const) {
      const months = scenario === "budget" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [null];
      for (const m of months) {
        const seller = get(se, sa, scenario, m);
        const buyer = get(be, ba, scenario, m);
        const [n, d] = fx[scenario];
        const expected = (seller * n) / d;
        const diff = buyer - expected;
        const where = `${se}:${sa} ↔ ${be}:${ba} ${scenario}${m ? ` month ${m}` : ""}`;
        if (seller === 0n && buyer === 0n) throw new Error(`IC pair missing on both sides: ${where}`);
        if (buyer === 0n || seller === 0n) push("intercompany_one_sided", `${se}+${be}`, where);
        else if (diff > TOL || diff < -TOL) push("intercompany_mismatch", `${se}+${be}`, where);
      }
    }
  }
  // IC balances (2027 closing)
  const bal: [string, string, string, string][] = [
    ["EMP2", "CxC relacionadas - AG Distribución", "EMP1", "2102"],
    ["EMP6", "A200", "EMP4", "2.4.01"],
  ];
  for (const [se, sa, be, ba] of bal) {
    if (get(se, sa, "balance", null) !== get(be, ba, "balance", null)) push("intercompany_mismatch", `${se}+${be}`, `${sa} ↔ ${ba} balance`);
  }
}

// ---------- compare with the answer key ----------

const key = read("answer_key_errors.csv")
  .split("\n")
  .slice(1)
  .filter(Boolean)
  .map((l) => {
    const [id, entity, , location, type] = splitCsv(l);
    return { id, entity, location, type };
  });

/** Expected detector output per planted error. */
const EXPECT: Record<string, (f: Found) => boolean> = {
  E01: (f) => f.type === "duplicate_row" && f.where === "line 52",
  E02: (f) => f.type === "intercompany_mismatch" && f.where === "EMP2:Ventas a AG Distribución ↔ EMP1:5102 budget month 3",
  E03: (f) => f.type === "subtotal_mismatch" && f.where === "line 15, column Jun",
  E04: (f) => f.type === "sign_error" && f.where === "line 71",
  E05: (f) => f.type === "missing_period" && f.where === "60-03 month 7",
  E06: (f) => f.type === "wrong_currency" && f.where === "line 32",
  E07: (f) => f.type === "unmapped_account" && f.where === "line 101",
  E08: (f) => f.type === "intercompany_one_sided" && f.where === "EMP6:R102 ↔ EMP4:6.1.05 budget month 12",
  E09: (f) => f.type === "number_format" && f.where === "line 80",
  E10: (f) => f.type === "balance_not_balanced" && f.entity === "EMP5",
  E11a: (f) => f.type === "fx_assumption_conflict" && f.entity === "EMP1" && f.where === "line 155",
  E11b: (f) => f.type === "fx_assumption_conflict" && f.entity === "EMP2" && f.where === "line 19",
  E11c: (f) => f.type === "fx_assumption_conflict" && f.entity === "EMP5" && f.where === "line 2",
};

let failed = 0;
const matched = new Set<Found>();
for (const k of key) {
  const hit = found.find((f) => f.type === k.type && EXPECT[k.id]?.(f));
  if (hit) {
    matched.add(hit);
    console.log(`✅ ${k.id} ${k.type} @ ${k.location}`);
  } else {
    failed++;
    console.log(`❌ ${k.id} ${k.type} @ ${k.location}: not present in fixtures`);
  }
}
if (key.length !== Object.keys(EXPECT).length) {
  failed++;
  console.log(`❌ answer key has ${key.length} rows, checker expects ${Object.keys(EXPECT).length}`);
}
/** Second symptom of a planted error, not a separate defect. */
const KNOCK_ON = [(f: Found) => f.type === "missing_period" && f.entity === "EMP4" && f.where === "6.1.05 month 12"]; // E08
const extra = found.filter((f) => !matched.has(f) && !KNOCK_ON.some((k) => k(f)));
for (const f of extra) {
  failed++;
  console.log(`❌ unplanted defect: ${f.type} ${f.entity} ${f.where}`);
}

const byEntity = Object.keys(ENTITY_CCY).map((e) => `${e}:${recs.filter((r) => r.entity === e).length}`);
console.log(`\nrecords ${recs.length} (${byEntity.join(" ")})`);
console.log(`${key.length - (failed - extra.length)}/${key.length} planted errors present, ${extra.length} unplanted`);
process.exit(failed ? 1 : 0);
