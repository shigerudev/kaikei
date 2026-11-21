import { SettingsNav } from "@/components/settings/settings-nav";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { dataSource } from "@/lib/api";
import { gPath } from "@/lib/ui/nav";

/** Settings shell stays mounted while switching sections: only the section content re-renders. */
export default async function SettingsLayout({ children, params }: LayoutProps<"/g/[group]/settings">) {
  const { group } = await params;
  return (
    <>
      <PageHeader group={group} crumbs={[{ label: "Configuración", href: gPath(group, "/settings/entities") }]} preview={dataSource() === "preview"} />
      <PageBody className="max-w-6xl">
        <PageTitle title="Configuración" description="La configuración son datos, no código: empresas, alias, tasas y reglas son entradas versionadas de cada ejecución." />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
          <SettingsNav group={group} />
          {children}
        </div>
      </PageBody>
    </>
  );
}
