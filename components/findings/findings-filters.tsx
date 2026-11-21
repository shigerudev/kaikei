"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** URL-driven filters for the findings center: severity, company, rule, status. */
export function FindingsFilters({ companies, rules, counts }: { companies: { id: string; name: string }[]; rules: string[]; counts: Record<string, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (!v || v === "all") next.delete(k);
    else next.set(k, v);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const active = ["severity", "company", "rule", "status"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={pending || undefined}>
      <ToggleGroup type="single" variant="outline" size="sm" value={params.get("severity") ?? "all"} onValueChange={(v) => update("severity", v || "all")} aria-label="Severidad">
        {["all", "BLOCKER", "WARNING", "INFO"].map((s) => (
          <ToggleGroupItem key={s} value={s} className="h-8 gap-1.5 px-2.5 text-xs">
            {({ all: "Todos", BLOCKER: "Bloqueantes", WARNING: "Advertencias", INFO: "Info" } as Record<string, string>)[s]}
            <span className="num text-muted-foreground">{counts[s] ?? 0}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Select value={params.get("company") ?? "all"} onValueChange={(v) => update("company", v)}>
        <SelectTrigger size="sm" className="h-8 w-44" aria-label="Empresa">
          <SelectValue placeholder="Todas las empresas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las empresas</SelectItem>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="font-mono text-[10px] text-muted-foreground">{c.id}</span> {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("rule") ?? "all"} onValueChange={(v) => update("rule", v)}>
        <SelectTrigger size="sm" className="h-8 w-32" aria-label="Regla">
          <SelectValue placeholder="Todas las reglas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las reglas</SelectItem>
          {rules.map((r) => (
            <SelectItem key={r} value={r} className="font-mono text-xs">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("status") ?? "open"} onValueChange={(v) => update("status", v === "open" ? null : v)}>
        <SelectTrigger size="sm" className="h-8 w-36" aria-label="Estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Abiertos</SelectItem>
          <SelectItem value="decided">Resueltos / aceptados</SelectItem>
          <SelectItem value="any">Cualquier estado</SelectItem>
        </SelectContent>
      </Select>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={() => start(() => router.replace(pathname, { scroll: false }))}
        >
          <XIcon /> Limpiar
        </Button>
      )}
    </div>
  );
}
