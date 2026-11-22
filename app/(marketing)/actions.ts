"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appHomeFor, safeNext } from "@/lib/hosts";
import { z } from "zod";
import { readSession, setSession } from "@/app/(marketing)/session";
import { getDict } from "@/components/site/dict";
import { isLang, type Lang, localize, PLAN_IDS } from "@/lib/ui/site";

export type FormState = {
  errors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

const values = (form: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));

function langOf(form: FormData): Lang {
  const v = String(form.get("lang") ?? "");
  return isLang(v) ? v : "es";
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const lang = langOf(form);
  const e = getDict(lang).errors;
  const schema = z.object({
    name: z.string().trim().min(1, e.name),
    email: z.email(e.email),
    password: z.string().min(8, e.password),
    plan: z.enum(PLAN_IDS).catch("free"),
  });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values: values(form, ["name", "email"]) };
  const { name, email, plan, password } = parsed.data;
  const engine = process.env.KAIKEI_API_URL?.replace(/\/$/, "");
  let token: string | undefined;
  if (engine) {
    const res = await fetch(`${engine}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { errors: { email: [detail || e.email] }, values: values(form, ["name", "email"]) };
    }
    const body = (await res.json()) as { token?: string };
    token = body.token;
  }
  await setSession({ name, email, plan, token });
  redirect(localize(lang, "/onboarding"));
}

export async function logIn(_prev: FormState, form: FormData): Promise<FormState> {
  const e = getDict(langOf(form)).errors;
  const schema = z.object({ email: z.email(e.email), password: z.string().min(1, e.passwordRequired) });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values: values(form, ["email"]) };
  const existing = await readSession();
  const engine = process.env.KAIKEI_API_URL?.replace(/\/$/, "");
  let token = existing?.token;
  let name = existing?.name ?? "";
  if (engine) {
    const res = await fetch(`${engine}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
    });
    if (!res.ok) {
      return { errors: { password: [e.passwordRequired] }, values: values(form, ["email"]) };
    }
    const body = (await res.json()) as { token?: string; user?: { name?: string } };
    token = body.token;
    name = body.user?.name || name;
  }
  await setSession({ email: parsed.data.email, name, plan: existing?.plan ?? "free", token });
  const next = String(form.get("next") ?? "");
  redirect(safeNext(next) ?? appHomeFor((await headers()).get("host")));
}

export async function completeOnboarding(_prev: FormState, form: FormData): Promise<FormState> {
  const lang = langOf(form);
  if (!(await readSession())) redirect(localize(lang, "/signup"));
  const e = getDict(lang).errors;
  const schema = z.object({
    group: z.string().trim().min(2, e.group),
    currency: z.string().regex(/^[A-Z]{3}$/, e.currency),
    companies: z.coerce.number().int().min(1, e.companies).max(500),
  });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values: values(form, ["group", "currency", "companies"]) };
  const engine = process.env.KAIKEI_API_URL?.replace(/\/$/, "");
  if (engine) {
    const session = await readSession();
    const res = await fetch(`${engine}/api/v1/groups`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(session?.token ? { authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify({
        name: parsed.data.group,
        reporting_currency: parsed.data.currency,
        scenario: "BUDGET_2027",
        fiscal_year: "2027",
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { errors: { group: [detail || e.group] }, values: values(form, ["group", "currency", "companies"]) };
    }
    const body = (await res.json()) as { slug?: string; id?: string };
    const slug = body.slug || body.id;
    if (slug) redirect(`/g/${slug}`);
  }
  redirect(appHomeFor((await headers()).get("host")));
}
