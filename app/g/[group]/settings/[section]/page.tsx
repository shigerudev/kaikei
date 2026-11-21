import { notFound } from "next/navigation";
import { CompanyTag } from "@/components/badges";
import { ResetPreview, SettingRow, ThemeSetting } from "@/components/settings/settings-forms";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { load } from "@/components/states";
import { dataSource, getCompanies, getGroup, getParameters, getRateSet } from "@/lib/api";
import { gPath, SETTINGS_SECTIONS } from "@/lib/ui/nav";

export const metadata = { title: "Group settings" };

/** Screen 1: group configuration — entities, rate set, parameters (read from the engine), plus UI prefs. */
export default async function SettingsPage({ params }: PageProps<"/g/[group]/settings/[section]">) {
  const { group, section } = await params;
  const meta = SETTINGS_SECTIONS.find((s) => s.key === section);
  if (!meta) notFound();
  const preview = dataSource() === "preview";

  return (
    <>
      <PageHeader group={group} crumbs={[{ label: "Group settings", href: gPath(group, "/settings/entities") }, { label: meta.label }]} preview={preview} />
      <PageBody className="max-w-6xl">
        <PageTitle title="Group settings" description="Configuration is data, not code: companies, aliases, rates and rules are versioned inputs to every run." />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
          <SettingsNav group={group} active={section} />
          <section className="min-w-0 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-medium">{meta.label}</h2>
              <p className="text-sm text-muted-foreground">{meta.description}</p>
            </div>
            <Section section={meta.key} group={group} preview={preview} />
          </section>
        </div>
      </PageBody>
    </>
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
                <th className="px-4 py-2 text-left font-medium">Company</th>
                <th className="px-3 py-2 text-left font-medium">Country</th>
                <th className="px-3 py-2 text-left font-medium">Currency</th>
                <th className="px-3 py-2 text-right font-medium">Ownership</th>
                <th className="px-4 py-2 text-left font-medium">Counterparty aliases</th>
              </tr>
            </thead>
            <tbody>
              {res.data.map((c) => (
                <tr key={c.id} className="border-b border-border/60 align-top last:border-b-0">
                  <td className="px-4 py-3"><CompanyTag id={c.id} name={c.name} /></td>
                  <td className="px-3 py-3 text-muted-foreground">{c.country}</td>
                  <td className="px-3 py-3 font-mono text-xs">{c.functional_currency}</td>
                  <td className="num px-3 py-3 text-right">{c.ownership_pct}% · full</td>
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
            Rate set <span className="font-mono text-xs text-foreground">{res.data.id}</span> · P&amp;L uses the period average, the balance sheet the closing rate. Local FX notes in files are reported and ignored.
          </p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Currency</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Period</th>
                  <th className="px-3 py-2 text-right font-medium">Units per USD</th>
                  <th className="px-3 py-2 text-right font-medium">USD per unit</th>
                  <th className="px-4 py-2 text-left font-medium">Applies to</th>
                </tr>
              </thead>
              <tbody>
                {res.data.rates.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{r.from_ccy}</td>
                    <td className="px-3 py-2.5 capitalize">{r.rate_type}</td>
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
        <SettingRow label="Theme" help="System follows your device setting.">
          <ThemeSetting />
        </SettingRow>
      );
    case "danger":
      return preview ? (
        <div className="rounded-xl border border-destructive/30 px-5">
          <SettingRow label="Restore the sample run" help="Six approved packs and run #1, as generated from the fixture pack.">
            <ResetPreview group={group} mode="full" />
          </SettingRow>
          <SettingRow label="Start from empty uploads" help="Clears everything so the demo can begin at the first upload.">
            <ResetPreview group={group} mode="empty" />
          </SettingRow>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Connected to the engine. Data is managed there; nothing to reset here.</p>
      );
    default:
      return null;
  }
}
