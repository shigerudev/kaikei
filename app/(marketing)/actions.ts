"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { readSession, setSession } from "@/app/(marketing)/session";
import { getDict } from "@/components/site/dict";
import { isLang, type Lang, localize, PLAN_IDS, SITE } from "@/lib/ui/site";

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
  const { name, email, plan } = parsed.data;
  await setSession({ name, email, plan });
  redirect(localize(lang, "/onboarding"));
}

export async function logIn(_prev: FormState, form: FormData): Promise<FormState> {
  const e = getDict(langOf(form)).errors;
  const schema = z.object({ email: z.email(e.email), password: z.string().min(1, e.passwordRequired) });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values: values(form, ["email"]) };
  const existing = await readSession();
  await setSession({ email: parsed.data.email, name: existing?.name ?? "", plan: existing?.plan ?? "free" });
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : SITE.appHome);
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
  // TODO(Antonio): create the group through the engine API (K6) and redirect to /g/<new-id>.
  redirect(SITE.appHome);
}
