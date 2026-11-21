import { notFound } from "next/navigation";
import { CopyField } from "@/components/copy-field";
import { CategoryAliases, ResetSample, SettingRow, ThemeSetting, WorkspaceNameForm } from "@/components/settings/settings-forms";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { load } from "@/components/states";
import { Button } from "@/components/ui/button";
import { getCategories, getWorkspaceInfo } from "@/lib/data";
import { SETTINGS_SECTIONS, wsPath } from "@/lib/nav";

export const metadata = { title: "Settings" };

/** Settings: full page with section nav (General, Categories, AI & MCP, Appearance, Danger zone). */
export default async function SettingsPage({ params }: PageProps<"/w/[ws]/settings/[section]">) {
  const { ws, section } = await params;
  const meta = SETTINGS_SECTIONS.find((s) => s.key === section);
  if (!meta) notFound();
  const info = await getWorkspaceInfo(ws);
  if (!info) notFound();

  return (
    <>
      <PageHeader crumbs={[{ label: "Settings", href: wsPath(ws, "/settings/general") }, { label: meta.label }]} preview={info.dataSource === "preview"} />
      <PageBody className="max-w-5xl">
        <PageTitle title="Settings" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
          <SettingsNav ws={ws} active={section} />
          <section className="min-w-0">
            <div className="mb-2 space-y-1">
              <h2 className="text-base font-medium">{meta.label}</h2>
              <p className="text-sm text-muted-foreground">{meta.description}</p>
            </div>
            <Section section={meta.key} ws={ws} info={info} />
          </section>
        </div>
      </PageBody>
    </>
  );
}

async function Section({ section, ws, info }: { section: string; ws: string; info: NonNullable<Awaited<ReturnType<typeof getWorkspaceInfo>>> }) {
  switch (section) {
    case "general":
      return (
        <div>
          <SettingRow label="Workspace name" help="Shown in the sidebar and to AI assistants.">
            <WorkspaceNameForm ws={ws} name={info.name} />
          </SettingRow>
          <SettingRow label="Base currency" help="Figures are calculated per currency and never summed across currencies. Set when the workspace is created.">
            <div className="flex h-8 items-center rounded-md border bg-muted/30 px-3 font-mono text-sm">{info.baseCurrency}</div>
          </SettingRow>
          <SettingRow label="Default period" help="Overview opens on the latest month that has recorded transactions. Use [ and ] to step between months.">
            <div className="flex h-8 items-center text-sm text-muted-foreground">Latest with data</div>
          </SettingRow>
        </div>
      );
    case "categories": {
      const res = await load(() => getCategories(ws));
      if (!res.ok) return res.node;
      return (
        <div>
          <p className="py-3 text-sm text-muted-foreground">
            Aliases teach imports which spreadsheet labels belong to a category — “entregas” → Deliveries. Matching ignores case and accents.
          </p>
          {res.data.map((c) => (
            <CategoryAliases key={c.id} ws={ws} category={c} />
          ))}
        </div>
      );
    }
    case "ai":
      return (
        <div>
          <SettingRow label="MCP endpoint" help="One read-only URL for this workspace. Grok, Claude and ChatGPT read the same figures the app shows.">
            <CopyField value={info.mcpUrl} label="MCP URL" masked />
          </SettingRow>
          <SettingRow label="Rotate URL" help="Issue a new secret URL. Assistants using the old one stop working immediately.">
            <Button variant="outline" size="sm" disabled title="Available once workspaces are stored in the database">
              Rotate URL
            </Button>
          </SettingRow>
          <SettingRow label="AI suggestions" help="Column mapping fallback and bill reading. With AI off, every step still works manually and figures never change.">
            <div className="flex h-8 items-center gap-2 text-sm">
              <span className={`size-2 rounded-full ${info.aiEnabled ? "bg-brand" : "bg-muted-foreground/50"}`} />
              {info.aiEnabled ? "On" : "Off"}
              <span className="text-muted-foreground">· set by the server (AI_ENABLED)</span>
            </div>
          </SettingRow>
        </div>
      );
    case "appearance":
      return (
        <SettingRow label="Theme" help="System follows your device setting.">
          <ThemeSetting />
        </SettingRow>
      );
    case "danger":
      return (
        <div className="mt-4 rounded-xl border border-destructive/30 p-5">
          <SettingRow label="Reset sample workspace" help={info.isSample ? "Removes everything you imported or confirmed and restores the original sample." : "Only sample workspaces can be reset."}>
            {info.isSample ? <ResetSample ws={ws} /> : <Button size="sm" variant="outline" disabled>Not available</Button>}
          </SettingRow>
        </div>
      );
    default:
      return null;
  }
}
