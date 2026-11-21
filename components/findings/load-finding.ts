import "server-only";
import { getCompanies, getFinding, getReconciliations, getRun } from "@/lib/api";

/** Finding + its IC match (if any) for the latest run. Shared by the sheet and the full page. */
export async function loadFinding(group: string, id: string) {
  const run = await getRun(group);
  if (!run) return null;
  const [finding, companies] = await Promise.all([getFinding(run.id, decodeURIComponent(id)), getCompanies(group)]);
  if (!finding) return null;
  const match = finding.match_group_id ? (await getReconciliations(run.id)).matches.find((m) => m.id === finding.match_group_id) ?? null : null;
  return { run, finding, companies, match };
}
