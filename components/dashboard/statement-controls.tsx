"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Statement tab (P&L / Balance) and the per-company breakdown toggle, both kept in the URL. */
export function StatementControls({ statement, byCompany }: { statement: "PL" | "BS"; byCompany: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (v === null) next.delete(k);
    else next.set(k, v);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-pending={pending || undefined}>
      <Tabs value={statement} onValueChange={(v) => set("statement", v === "PL" ? null : v)}>
        <TabsList>
          <TabsTrigger value="PL">Income statement</TabsTrigger>
          <TabsTrigger value="BS">Balance sheet</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
        <Switch id="by-company" checked={byCompany} onCheckedChange={(v) => set("view", v ? "companies" : null)} />
        <Label htmlFor="by-company" className="text-sm text-muted-foreground">
          By company
        </Label>
      </div>
    </div>
  );
}
