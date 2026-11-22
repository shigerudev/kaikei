"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { addCompanyAction, addRateSetAction, replaceParametersAction } from "@/app/g/[group]/actions";
import { Button } from "@/components/ui/button";
import type { Parameter } from "@/lib/api/types";

export function AddCompanyForm({ group }: { group: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 grid gap-2 rounded-xl border p-4 sm:grid-cols-2"
      action={(form) =>
        start(async () => {
          const res = await addCompanyAction(group, form);
          if (!res.ok) toast.error(res.error);
          else toast.success("Empresa añadida");
        })
      }
    >
      <input name="name" required placeholder="Nombre" className="h-9 rounded-md border px-3 text-sm" />
      <input name="code" placeholder="Código (STUDIOS)" className="h-9 rounded-md border px-3 font-mono text-sm" />
      <input name="country" required maxLength={2} placeholder="País ISO-2" className="h-9 rounded-md border px-3 font-mono text-sm uppercase" />
      <input name="functional_currency" required maxLength={3} placeholder="Moneda ISO" className="h-9 rounded-md border px-3 font-mono text-sm uppercase" />
      <input name="ownership_pct" required placeholder="Participación %" className="h-9 rounded-md border px-3 font-mono text-sm" />
      <input name="aliases" placeholder="Alias separados por |" className="h-9 rounded-md border px-3 text-sm sm:col-span-2" />
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          Añadir empresa
        </Button>
      </div>
    </form>
  );
}

export function AddRateForm({ group }: { group: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 grid gap-2 rounded-xl border p-4 sm:grid-cols-2"
      action={(form) =>
        start(async () => {
          const res = await addRateSetAction(group, form);
          if (!res.ok) toast.error(res.error);
          else toast.success("Juego de tasas publicado");
        })
      }
    >
      <input name="from_ccy" required maxLength={3} placeholder="De (GTQ)" className="h-9 rounded-md border px-3 font-mono text-sm uppercase" />
      <input name="period" required placeholder="Periodo (2027 o 2027-12)" className="h-9 rounded-md border px-3 font-mono text-sm" />
      <select name="rate_type" className="h-9 rounded-md border px-3 text-sm" defaultValue="average">
        <option value="average">Promedio</option>
        <option value="closing">Cierre</option>
      </select>
      <input name="rate" required placeholder="USD por 1 unidad" className="h-9 rounded-md border px-3 font-mono text-sm" />
      <input name="units_per_usd" placeholder="Unidades por USD" className="h-9 rounded-md border px-3 font-mono text-sm sm:col-span-2" />
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          Publicar tasas
        </Button>
      </div>
    </form>
  );
}

export function ParametersForm({ group, rows }: { group: string; rows: Parameter[] }) {
  const [pending, start] = useTransition();
  const seed = rows.length
    ? rows
    : [{ parameter: "ic_match_tolerance", scope: "group", value: "1.00", unit: "USD", used_for: "", source: "" }];
  return (
    <form
      className="mt-4 space-y-3"
      action={(form) =>
        start(async () => {
          const res = await replaceParametersAction(group, form);
          if (!res.ok) toast.error(res.error);
          else toast.success("Parámetros guardados");
        })
      }
    >
      {seed.map((p, i) => (
        <div key={`${p.parameter}-${p.scope}-${i}`} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-3">
          <input name="parameter" defaultValue={p.parameter} className="h-9 rounded-md border px-3 font-mono text-sm" />
          <input name="scope" defaultValue={p.scope} className="h-9 rounded-md border px-3 text-sm" />
          <input name="value" defaultValue={p.value} className="h-9 rounded-md border px-3 font-mono text-sm" />
          <input name="unit" defaultValue={p.unit} className="h-9 rounded-md border px-3 text-sm" />
          <input name="used_for" defaultValue={p.used_for} className="h-9 rounded-md border px-3 text-sm sm:col-span-2" />
          <input type="hidden" name="source" defaultValue={p.source} />
        </div>
      ))}
      <Button type="submit" size="sm" disabled={pending}>
        Guardar parámetros
      </Button>
    </form>
  );
}
