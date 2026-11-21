import { loadFinding } from "@/components/findings/load-finding";
import { DetailSheet } from "@/components/detail-sheet";
import { FindingDetail } from "@/components/findings/finding-detail";
import { gPath } from "@/lib/ui/nav";

/** Intercepted finding: opens as a sheet over the findings list (or any screen linking to it). */
export default async function FindingSheet({ params }: PageProps<"/g/[group]/findings/[id]">) {
  const { group, id } = await params;
  const data = await loadFinding(group, id).catch(() => null);
  if (!data) return null;
  const f = data.finding;
  return (
    <DetailSheet title={`${f.reference ?? f.rule_id} · ${f.title}`} description={f.source_refs[0]?.filename} fullHref={gPath(group, `/findings/${f.id}`)}>
      <FindingDetail group={group} finding={f} match={data.match} companies={data.companies} />
    </DetailSheet>
  );
}
