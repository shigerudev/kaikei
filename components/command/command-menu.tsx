"use client";

import {
  ArrowRightIcon,
  BuildingIcon,
  CalendarIcon,
  FileSpreadsheetIcon,
  FlagIcon,
  HistoryIcon,
  MonitorIcon,
  MoonIcon,
  PlayIcon,
  RotateCcwIcon,
  SigmaIcon,
  SunIcon,
  UploadIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { openTour } from "@/components/onboarding-tour";
import { NavIcon } from "@/components/shell/nav-icon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { SearchHit } from "@/lib/api/types";
import { formatPeriod } from "@/lib/ui/format";
import { gPath, NAV, SETTINGS_SECTIONS } from "@/lib/ui/nav";

type Ctx = { open: () => void };
const CommandMenuContext = React.createContext<Ctx>({ open: () => {} });
export const useCommandMenu = () => React.useContext(CommandMenuContext);

const RECENTS_KEY = "kaikei:recents:v2";

function readRecents(): SearchHit[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as SearchHit[];
  } catch {
    return [];
  }
}

function pushRecent(item: SearchHit) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify([item, ...readRecents().filter((r) => r.id !== item.id)].slice(0, 5)));
  } catch {
    /* storage unavailable: recents are a convenience only */
  }
}

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

const KIND_ICON = { company: BuildingIcon, account: SigmaIcon, finding: FlagIcon, file: FileSpreadsheetIcon, run: PlayIcon } as const;
const KIND_LABEL = { finding: "Hallazgos", account: "Cuentas", company: "Empresas", file: "Archivos", run: "Ejecuciones" } as const;
const KIND_ORDER: SearchHit["kind"][] = ["finding", "account", "company", "file", "run"];

/** Move through the period options (display order) — `]` next, `[` previous. */
const step = (options: string[], current: string, dir: 1 | -1) => {
  const i = options.indexOf(current);
  return i < 0 ? undefined : options[i + dir];
};

/**
 * ⌘K palette + global keyboard shortcuts. Deliberately no open/close animation (used constantly).
 * Shortcuts: ⌘K or / opens · G then D/U/R/F/I/S navigates · [ ] steps the period on the dashboard.
 */
export function CommandMenuProvider({ group, periods, children }: { group: string; periods: string[]; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [recents, setRecents] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setTheme } = useTheme();
  const onDashboard = pathname === gPath(group) || pathname === "/";

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onOpenChange = React.useCallback((next: boolean) => {
    if (next) setRecents(readRecents());
    else setQuery("");
    setOpen(next);
  }, []);

  const currentPeriod = searchParams.get("period") ?? periods.at(-1);

  const setPeriod = React.useCallback(
    (period: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", period);
      router.replace(`${gPath(group)}?${params.toString()}`, { scroll: false });
    },
    [group, router, searchParams],
  );

  React.useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!openRef.current);
        return;
      }
      if (isTyping(e) || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "/") {
        e.preventDefault();
        onOpenChange(true);
        return;
      }
      if ((e.key === "[" || e.key === "]") && onDashboard && currentPeriod) {
        const next = step(periods, currentPeriod, e.key === "]" ? 1 : -1);
        if (next) setPeriod(next);
        return;
      }
      const key = e.key.toUpperCase();
      if (key === "G") {
        pendingG = Date.now();
        return;
      }
      if (pendingG && Date.now() - pendingG < 900) {
        const item = NAV.find((n) => n.shortcut === key);
        pendingG = 0;
        if (item) {
          e.preventDefault();
          router.push(gPath(group, item.path));
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [currentPeriod, group, onDashboard, onOpenChange, periods, router, setPeriod]);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const hits = await fetch(`/g/${group}/search?q=${encodeURIComponent(q)}`, { headers: { accept: "application/json" } })
        .then((r) => (r.ok ? (r.json() as Promise<{ results: SearchHit[] }>) : { results: [] }))
        .then((d) => d.results)
        .catch(() => [] as SearchHit[]);
      if (!cancelled) {
        setResults(hits);
        setLoading(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, group]);

  const grouped = React.useMemo(() => {
    if (query.trim().length < 2) return [];
    return KIND_ORDER.map((k) => [k, results.filter((r) => r.kind === k)] as const).filter(([, items]) => items.length);
  }, [results, query]);

  const openHit = (r: SearchHit) => {
    pushRecent(r);
    go(r.href);
  };

  const ctx = React.useMemo(() => ({ open: () => onOpenChange(true) }), [onOpenChange]);

  return (
    <CommandMenuContext.Provider value={ctx}>
      {children}
      <CommandDialog open={open} onOpenChange={onOpenChange} title="Menú de comandos" description="Busca hallazgos, cuentas y empresas, ve a una pantalla o ejecuta una acción.">
        <Command className="**:data-[slot=command-input-wrapper]:h-12">
        <CommandInput placeholder="Busca hallazgos (E02), cuentas, empresas… o escribe un comando" value={query} onValueChange={setQuery} />
        <CommandList className="max-h-[min(440px,60vh)]">
          <CommandEmpty>{loading ? "Buscando…" : "Sin resultados."}</CommandEmpty>

          {query.trim().length < 2 && recents.length > 0 && (
            <CommandGroup heading="Recientes">
              {recents.map((r) => (
                <Hit key={`recent-${r.id}`} r={r} onSelect={() => openHit(r)} recent />
              ))}
            </CommandGroup>
          )}

          {grouped.map(([kind, items]) => (
            <CommandGroup key={kind} heading={KIND_LABEL[kind]} forceMount>
              {items.map((r) => (
                <Hit key={r.id} r={r} onSelect={() => openHit(r)} />
              ))}
            </CommandGroup>
          ))}

          {grouped.length > 0 && <CommandSeparator />}

          <CommandGroup heading="Acciones">
            <CommandItem value="upload packs files import ingest" onSelect={() => go(gPath(group, "/uploads"))}>
              <UploadIcon /> Subir paquetes de empresas
            </CommandItem>
            <CommandItem value="start new run rerun consolidation" onSelect={() => go(gPath(group, "/runs?start=1"))}>
              <PlayIcon /> Nueva ejecución
            </CommandItem>
            <CommandItem value="open blockers findings severity" onSelect={() => go(gPath(group, "/findings?severity=BLOCKER"))}>
              <FlagIcon /> Ver bloqueantes abiertos
            </CommandItem>
            <CommandItem value="tutorial onboarding ayuda recorrido" onSelect={() => { setOpen(false); openTour(); }}>
              <PlayIcon /> Ver tutorial
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Ir a">
            {NAV.map((n) => (
              <CommandItem key={n.key} value={`${n.label} ${n.keywords.join(" ")}`} onSelect={() => go(gPath(group, n.path))}>
                <NavIcon nav={n.key} />
                {n.label}
                <CommandShortcut>G {n.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
            {SETTINGS_SECTIONS.filter((s) => s.key !== "entities").map((s) => (
              <CommandItem key={s.key} value={`settings ${s.label} ${s.description}`} onSelect={() => go(gPath(group, `/settings/${s.key}`))}>
                <ArrowRightIcon /> Configuración › {s.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {periods.length > 0 && (
            <CommandGroup heading="Periodo del panel">
              {periods.map((p) => (
                <CommandItem
                  key={p}
                  value={`period ${formatPeriod(p, true)} ${p}`}
                  onSelect={() => {
                    setOpen(false);
                    setPeriod(p);
                  }}
                >
                  <CalendarIcon />
                  {formatPeriod(p, true)}
                  {p === currentPeriod && <span className="ml-auto text-xs text-muted-foreground">Actual</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Tema">
            <CommandItem value="theme light mode" onSelect={() => { setTheme("light"); setOpen(false); }}>
              <SunIcon /> Tema claro
            </CommandItem>
            <CommandItem value="theme dark mode" onSelect={() => { setTheme("dark"); setOpen(false); }}>
              <MoonIcon /> Tema oscuro
            </CommandItem>
            <CommandItem value="theme system auto" onSelect={() => { setTheme("system"); setOpen(false); }}>
              <MonitorIcon /> Tema del sistema
            </CommandItem>
            <CommandItem value="reset preview data" onSelect={() => go(gPath(group, "/settings/danger"))}>
              <RotateCcwIcon /> Restablecer datos de ejemplo…
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="font-sans">↑↓</kbd> navegar</span>
          <span><kbd className="font-sans">↵</kbd> abrir</span>
          <span><kbd className="font-sans">esc</kbd> cerrar</span>
          <span className="ml-auto hidden sm:inline">G y una letra para saltar</span>
        </div>
        </Command>
      </CommandDialog>
    </CommandMenuContext.Provider>
  );
}

function Hit({ r, onSelect, recent }: { r: SearchHit; onSelect: () => void; recent?: boolean }) {
  const Icon = recent ? HistoryIcon : KIND_ICON[r.kind];
  return (
    <CommandItem value={`${r.kind} ${r.id} ${r.title} ${r.subtitle}`} onSelect={onSelect}>
      <Icon />
      <span className="min-w-0 flex-1 truncate">
        {r.title}
        <span className="ml-2 text-muted-foreground">{r.subtitle}</span>
      </span>
    </CommandItem>
  );
}
