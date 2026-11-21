"use client";

import { ArrowRightIcon, LoaderIcon } from "lucide-react";
import { addTransitionType, useActionState, useId } from "react";
import { completeOnboarding, type FormState, logIn, signUp } from "@/app/(marketing)/actions";
import type { Dict } from "@/components/site/dict";
import { useLang } from "@/components/site/site-link";
import { cn } from "@/lib/utils";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;
type T = Dict["auth"];

/** Runs the server action inside the form transition and tags it, so the redirect slides forward. */
function useForwardAction(action: Action) {
  const [state, dispatch, pending] = useActionState(action, {});
  const formAction = (form: FormData) => {
    addTransitionType("nav-forward");
    dispatch(form);
  };
  return { state, formAction, pending };
}

function Field({
  name,
  label,
  hint,
  state,
  className,
  ...input
}: React.ComponentProps<"input"> & { name: string; label: string; hint?: string; state: FormState }) {
  const id = useId();
  const error = state.errors?.[name]?.[0];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="t-small font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={state.values?.[name]}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        className="field"
        {...input}
      />
      {(error || hint) && (
        <p id={`${id}-note`} className={cn("t-small", error ? "font-medium text-ink" : "text-ink/65")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="btn btn-ink mt-2 w-full">
      {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden /> : null}
      {children}
      {!pending && <ArrowRightIcon className="size-4" aria-hidden />}
    </button>
  );
}

function LangInput() {
  return <input type="hidden" name="lang" value={useLang()} />;
}

export function SignUpForm({ plan, t }: { plan: string; t: T }) {
  const { state, formAction, pending } = useForwardAction(signUp);
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <LangInput />
      <input type="hidden" name="plan" value={plan} />
      <Field name="name" label={t.name} autoComplete="name" state={state} required />
      <Field name="email" label={t.workEmail} type="email" autoComplete="email" inputMode="email" state={state} required />
      <Field name="password" label={t.password} type="password" autoComplete="new-password" hint={t.passwordHint} state={state} required />
      <Submit pending={pending}>{t.createAccount}</Submit>
    </form>
  );
}

export function LogInForm({ next, t, compact }: { next?: string; t: T; compact?: boolean }) {
  const { state, formAction, pending } = useForwardAction(logIn);
  return (
    <form action={formAction} className={cn("flex flex-col", compact ? "gap-3.5" : "gap-5")} noValidate>
      <LangInput />
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="email" label={t.email} type="email" autoComplete="email" inputMode="email" state={state} required />
      <Field name="password" label={t.password} type="password" autoComplete="current-password" state={state} required />
      <Submit pending={pending}>{t.logIn}</Submit>
    </form>
  );
}

const CURRENCIES = ["USD", "EUR", "GBP", "MXN", "GTQ", "COP", "BRL", "JPY"];

export function OnboardingForm({ t }: { t: T }) {
  const { state, formAction, pending } = useForwardAction(completeOnboarding);
  const currencyId = useId();
  const currencyError = state.errors?.currency?.[0];
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <LangInput />
      <Field name="group" label={t.group} placeholder="Grupo AG" autoComplete="organization" state={state} required />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={currencyId} className="t-small font-semibold">
            {t.currency}
          </label>
          <select id={currencyId} name="currency" defaultValue={state.values?.currency ?? "USD"} aria-invalid={currencyError ? true : undefined} className="field appearance-none">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {currencyError && <p className="t-small font-medium">{currencyError}</p>}
        </div>
        <Field name="companies" label={t.companies} type="number" min={1} inputMode="numeric" placeholder="6" state={state} required />
      </div>
      <Submit pending={pending}>{t.createGroup}</Submit>
    </form>
  );
}
