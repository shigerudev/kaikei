import { notFound } from "next/navigation";
import { CompanyTag } from "@/components/badges";
import { ResetPreview, SettingRow, ThemeSetting } from "@/components/settings/settings-forms";
import { load } from "@/components/states";
import { dataSource, getCompanies, getGroup, getParameters, getRateSet } from "@/lib/api";
import { SETTINGS_SECTIONS } from "@/lib/ui/nav";

export const metadata = { title: "Configuración" };

/** Screen 1: group configuration — entities, rate set, parameters (read from the engine), plus UI prefs. */
export default async function SettingsPage({ params }: PageProps<"/g/[group]/settings/[section]">) {
  const { group, section } = await params;
  const meta = SETTINGS_SECTIONS.find((s) => s.key === section);
  if (!meta) notFound();
  const preview = dataSource() === "preview";

  return (
    <section className="enter min-w-0 space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-medium">{meta.label}</h2>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
      </div>
      <Section section={meta.key} group={group} preview={preview} />
    </section>
  );
}

async function Section({ section, group, preview }: { section: string; group: string; preview: boolean }) {
  switch (section) {
    case "entities": {
      const res = await load(() => getCompanies(group));
      if (!res.ok) return res.node;
      return (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Empresa</th>
                <th className="px-3 py-2 text-left font-medium">País</th>
                <th className="px-3 py-2 text-left font-medium">Moneda</th>
                <th className="px-3 py-2 text-right font-medium">Participación</th>
                <th className="px-4 py-2 text-left font-medium">Alias de contraparte</th>
              </tr>
            </thead>
            <tbody>
              {res.data.map((c) => (
                <tr key={c.id} className="border-b border-border/60 align-top last:border-b-0">
                  <td className="px-4 py-3"><CompanyTag id={c.id} name={c.name} /></td>
                  <td className="px-3 py-3 text-muted-foreground">{c.country}</td>
                  <td className="px-3 py-3 font-mono text-xs">{c.functional_currency}</td>
                  <td className="num px-3 py-3 text-right">{c.ownership_pct}% · total</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {c.aliases.map((a) => (
                        <span key={a} className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs">{a}</span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "rates": {
      const res = await load(() => getRateSet(group));
      if (!res.ok) return res.node;
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Juego de tasas <span className="font-mono text-xs text-foreground">{res.data.id}</span> · resultados usan el promedio del periodo; el balance, la tasa de cierre. Las notas de tipo de cambio locales se reportan e ignoran.
          </p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Moneda</th>
                  <th className="px-3 py-2 text-left font-medium">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium">Periodo</th>
                  <th className="px-3 py-2 text-right font-medium">Unidades por USD</th>
                  <th className="px-3 py-2 text-right font-medium">USD por unidad</th>
                  <th className="px-4 py-2 text-left font-medium">Aplica a</th>
                </tr>
              </thead>
              <tbody>
                {res.data.rates.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{r.from_ccy}</td>
                    <td className="px-3 py-2.5">{r.rate_type === "average" ? "Promedio" : "Cierre"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.period}</td>
                    <td className="num px-3 py-2.5 text-right">{r.units_per_usd}</td>
                    <td className="num px-3 py-2.5 text-right text-muted-foreground">{r.rate}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.applies_to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    case "parameters": {
      const res = await load(() => Promise.all([getParameters(group), getGroup(group)]));
      if (!res.ok) return res.node;
      return (
        <div>
          {res.data[0].map((p) => (
            <SettingRow key={`${p.parameter}-${p.scope}`} label={`${p.parameter.replace(/_/g, " ")}${p.scope !== "group" ? ` · ${p.scope}` : ""}`} help={p.used_for}>
              <div className="flex h-8 items-center justify-end gap-2 rounded-md border bg-muted/30 px-3 font-mono text-sm">
                {p.value} <span className="text-xs text-muted-foreground">{p.unit}</span>
              </div>
            </SettingRow>
          ))}
        </div>
      );
    }
    case "appearance":
      return (
        <SettingRow label="Tema" help="Sistema sigue la configuración de tu dispositivo.">
          <ThemeSetting />
        </SettingRow>
      );
    case "danger":
      return preview ? (
        <div className="rounded-xl border border-destructive/30 px-5">
          <SettingRow label="Restaurar el ejemplo" help="Seis paquetes aprobados y la ejecución #1.">
            <ResetPreview group={group} mode="full" />
          </SettingRow>
          <SettingRow label="Empezar sin cargas" help="Borra todo para empezar desde la primera carga.">
            <ResetPreview group={group} mode="empty" />
          </SettingRow>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Conectado al motor. Los datos se administran allí; no hay nada que restablecer.</p>
      );
    default:
      return null;
  }
}
