"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { saveMappingAction } from "@/app/g/[group]/actions";
import { Button } from "@/components/ui/button";
import type { MappingDraft } from "@/lib/api";

export function MappingForm({
  group,
  companyId,
  draft,
  accounts,
}: {
  group: string;
  companyId: string;
  draft: MappingDraft;
  accounts: { code: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      action={(form) =>
        start(async () => {
          const res = await saveMappingAction(group, companyId, form);
          if (!res.ok) toast.error(res.error);
          else toast.success("Borrador de mapeo guardado");
        })
      }
    >
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Código local</th>
              <th className="px-3 py-2 text-left font-medium">Nombre local</th>
              <th className="px-3 py-2 text-left font-medium">Cuenta del grupo</th>
              <th className="px-4 py-2 text-left font-medium">Contraparte</th>
            </tr>
          </thead>
          <tbody>
            {draft.accounts.map((row) => (
              <tr key={row.local_code} className="border-b border-border/60 last:border-b-0">
                <td className="px-4 py-2 font-mono text-xs">
                  <input type="hidden" name="local_code" value={row.local_code} />
                  {row.local_code}
                </td>
                <td className="px-3 py-2">
                  <input type="hidden" name="local_name" value={row.local_name} />
                  {row.local_name}
                </td>
                <td className="px-3 py-2">
                  <select name="group_account" defaultValue={row.group_account ?? ""} className="h-8 w-full rounded-md border bg-background px-2 font-mono text-xs">
                    <option value="">—</option>
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input name="partner" defaultValue={row.partner ?? ""} placeholder="código" className="h-8 w-full rounded-md border px-2 font-mono text-xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Guardar mapeo
      </Button>
    </form>
  );
}
