"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** URL-driven filters (shareable, back-button friendly). Text search is debounced 200ms. */
export function FilterBar({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q }), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const evidence = params.get("evidence") ?? "all";
  const active = Boolean(params.get("q") || params.get("category") || params.get("evidence") || params.get("flagged"));

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={pending || undefined}>
      <div className="relative w-full sm:w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by description…" className="h-8 pl-8" aria-label="Filter transactions" />
      </div>
      <Select value={params.get("category") ?? "all"} onValueChange={(v) => update({ category: v })}>
        <SelectTrigger size="sm" className="h-8 w-40" aria-label="Category">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ToggleGroup type="single" variant="outline" size="sm" value={evidence} onValueChange={(v) => update({ evidence: v || "all" })} aria-label="Bill attached">
        <ToggleGroupItem value="all" className="h-8 px-2.5 text-xs">All</ToggleGroupItem>
        <ToggleGroupItem value="yes" className="h-8 px-2.5 text-xs">With bill</ToggleGroupItem>
        <ToggleGroupItem value="no" className="h-8 px-2.5 text-xs">No bill</ToggleGroupItem>
      </ToggleGroup>
      <Button
        variant={params.get("flagged") ? "secondary" : "ghost"}
        size="sm"
        className="h-8"
        aria-pressed={Boolean(params.get("flagged"))}
        onClick={() => update({ flagged: params.get("flagged") ? null : "1" })}
      >
        Flagged only
      </Button>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={() => {
            setQ("");
            update({ q: null, category: null, evidence: null, flagged: null });
          }}
        >
          <XIcon /> Clear
        </Button>
      )}
    </div>
  );
}
