"use server";
/**
 * Server actions for group screens (owner: Jordi). Thin wrappers over lib/api; every mutation refreshes
 * the router so results re-render from the API (never patched client-side).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { refresh } from "next/cache";
import * as api from "@/lib/api";
import type { FindingDecision, Parameter, Run, SearchHit } from "@/lib/api/types";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (err) {
    console.error("[action]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Algo salió mal." };
  }
}

const MAX_BYTES = 20 * 1024 * 1024;
const ACTOR = "Revisor";
const CSV_ONLY = /\.csv$/i;

export async function searchAction(group: string, q: string): Promise<SearchHit[]> {
  return api.search(group, q.slice(0, 100));
}

export async function uploadAction(group: string, form: FormData) {
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) return { ok: false as const, error: "Elige al menos un archivo." };
  const bad = files.find((f) => !CSV_ONLY.test(f.name));
  if (bad) return { ok: false as const, error: `${bad.name} no es un archivo CSV.` };
  if (files.some((f) => f.size > MAX_BYTES)) return { ok: false as const, error: "Los archivos deben pesar menos de 20 MB." };
  const companyId = String(form.get("company_id") ?? "").trim() || undefined;
  return run(async () => {
    const out = [];
    for (const f of files) out.push(await api.uploadFile(group, f, companyId));
    return out.map((o) => ({ company_id: o.file.company_id, filename: o.file.filename, alreadyImported: o.alreadyImported }));
  });
}

/** Preview only: feed the six fixture packs through the same upload path. */
export async function loadSamplePacksAction(group: string) {
  if (api.dataSource() !== "preview") return { ok: false as const, error: "Los paquetes de ejemplo solo están en el espacio de ejemplo." };
  return run(async () => {
    const companies = await api.getCompanies(group);
    for (const c of companies) {
      const bytes = await readFile(path.join(process.cwd(), "fixtures", "grupo-ag", c.filename));
      await api.uploadFile(group, new File([bytes], c.filename, { type: "text/csv" }));
    }
    return companies.length;
  });
}

export async function approveMappingAction(group: string, companyId: string) {
  return run(() => api.approveMapping(group, companyId));
}

export async function saveMappingAction(group: string, companyId: string, form: FormData) {
  const accounts: { local_code: string; local_name?: string; group_account?: string; partner?: string }[] = [];
  const codes = form.getAll("local_code").map(String);
  for (const [i, local_code] of codes.entries()) {
    accounts.push({
      local_code,
      local_name: String(form.getAll("local_name")[i] ?? local_code),
      group_account: String(form.getAll("group_account")[i] ?? "") || undefined,
      partner: String(form.getAll("partner")[i] ?? "") || undefined,
    });
  }
  return run(() => api.putCompanyMapping(group, companyId, accounts));
}

export async function addCompanyAction(group: string, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const country = String(form.get("country") ?? "").trim().toUpperCase();
  const functional_currency = String(form.get("functional_currency") ?? "").trim().toUpperCase();
  const ownership_pct = String(form.get("ownership_pct") ?? "").trim();
  const code = String(form.get("code") ?? "").trim() || undefined;
  const aliases = String(form.get("aliases") ?? "")
    .split("|")
    .map((a) => a.trim())
    .filter(Boolean);
  if (!name || country.length !== 2 || !/^[A-Z]{3}$/.test(functional_currency) || !ownership_pct) {
    return { ok: false as const, error: "Completa nombre, país (ISO-2), moneda ISO y participación." };
  }
  return run(() =>
    api.addCompany(group, { name, country, functional_currency, ownership_pct, aliases, code }),
  );
}

export async function addRateSetAction(group: string, form: FormData) {
  const from_ccy = String(form.get("from_ccy") ?? "").trim().toUpperCase();
  const period = String(form.get("period") ?? "").trim();
  const rate_type = String(form.get("rate_type") ?? "average");
  const rate = String(form.get("rate") ?? "").trim();
  const units_per_usd = String(form.get("units_per_usd") ?? "").trim() || undefined;
  if (!from_ccy || !period || !rate || (rate_type !== "average" && rate_type !== "closing")) {
    return { ok: false as const, error: "Completa moneda, periodo, tipo y tasa (USD por unidad)." };
  }
  return run(() =>
    api.addRateSet(group, {
      rates: [
        {
          from_ccy,
          to_ccy: "USD",
          period,
          rate_type,
          rate,
          units_per_usd,
        },
      ],
    }),
  );
}

export async function replaceParametersAction(group: string, form: FormData) {
  const n = form.getAll("parameter").length;
  const rows: Parameter[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      parameter: String(form.getAll("parameter")[i] ?? ""),
      scope: String(form.getAll("scope")[i] ?? "group"),
      value: String(form.getAll("value")[i] ?? ""),
      unit: String(form.getAll("unit")[i] ?? ""),
      used_for: String(form.getAll("used_for")[i] ?? ""),
      source: String(form.getAll("source")[i] ?? ""),
    });
  }
  return run(() => api.replaceParameters(group, rows));
}

export async function startRunAction(group: string, reason: string): Promise<Result<Run>> {
  return run(() => api.startRun(group, reason.trim() || "Reejecución manual"));
}

export async function decideAction(findingId: string, action: FindingDecision["action"], reason: string): Promise<Result<Run>> {
  if (!reason.trim()) return { ok: false, error: "Agrega un motivo para que la decisión sea auditable." };
  return run(() => api.decideFinding(findingId, action, reason, ACTOR));
}

export async function publishAction(runId: string): Promise<Result<Run>> {
  return run(() => api.publishRun(runId));
}

export async function resetPreviewAction(mode: "full" | "empty") {
  return run(() => api.resetPreview(mode));
}

/** Sign out of the platform: clears the shared session cookie and returns to the marketing login. */
export async function logOutAction() {
  const { cookies, headers } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { COOKIE_DOMAIN, SITE_ORIGIN, hostRole } = await import("@/lib/hosts");
  const { readSession } = await import("@/app/(marketing)/session");
  const session = await readSession();
  const engine = process.env.KAIKEI_API_URL?.replace(/\/$/, "");
  if (engine && session?.token) {
    await fetch(`${engine}/api/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${session.token}` },
    }).catch(() => undefined);
  }
  const role = hostRole((await headers()).get("host"));
  const jar = await cookies();
  jar.delete("kaikei_session");
  if (role !== "both") jar.set("kaikei_session", "", { path: "/", domain: COOKIE_DOMAIN, maxAge: 0 });
  redirect(role === "both" ? "/login" : `${SITE_ORIGIN}/login`);
}
