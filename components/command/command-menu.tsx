"use client";

import {
  ArrowRightIcon,
  CalendarIcon,
  ClipboardCopyIcon,
  FileTextIcon,
  FlagIcon,
  FolderIcon,
  HistoryIcon,
  MonitorIcon,
  MoonIcon,
  ReceiptIcon,
  RotateCcwIcon,
  SunIcon,
  UploadIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NavIcon } from "@/components/shell/nav-icon";
import type { SearchResult } from "@/lib/data/types";
import { formatPeriod, shiftPeriod } from "@/lib/format";
import { formatMinor } from "@/lib/money";
import { NAV, SETTINGS_SECTIONS, wsPath } from "@/lib/nav";

type Ctx = { open: () => void };
const CommandMenuContext = React.createContext<Ctx>({ open: () => {} });
export const useCommandMenu = () => React.useContext(CommandMenuContext);

const RECENTS_KEY = "kaikei:recents";

function readRecents(): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as SearchResult[];
  } catch {
    return [];
  }
}

function pushRecent(item: SearchResult) {
  try {
    const next = [item, ...readRecents().filter((r) => r.id !== item.id)].slice(0, 5);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: recents are a convenience only */
  }
}

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

const KIND_ICON = { transaction: ReceiptIcon, document: FileTextIcon, category: FolderIcon, flag: FlagIcon } as const;
const KIND_LABEL = { transaction: "Transactions", document: "Documents", category: "Categories", flag: "Review" } as const;

/**
 * ⌘K palette + global keyboard shortcuts. Deliberately no open/close animation (used constantly).
 * Shortcuts: ⌘K or / opens · G then O/I/T/D/R/C/S navigates · [ ] steps the period · ⌘U imports.
 */
export function CommandMenuProvider({
  ws,
  periods,
  defaultPeriod,
  mcpUrl,
  children,
}: {
  ws: string;
  periods: string[];
  defaultPeriod: string | null;
  mcpUrl: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [recents, setRecents] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setTheme } = useTheme();

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

  const currentPeriod = searchParams.get("period") ?? defaultPeriod;

  const setPeriod = React.useCallback(
    (period: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", period);
      const onPeriodPage = pathname === wsPath(ws) || pathname.startsWith(wsPath(ws, "/transactions"));
      router.replace(`${onPeriodPage ? pathname : wsPath(ws)}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, ws],
  );

  // Global shortcuts
  React.useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!openRef.current);
        return;
      }
      if (isTyping(e) || e.altKey) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") {
        e.preventDefault();
        router.push(wsPath(ws, "/import"));
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "/") {
        e.preventDefault();
        onOpenChange(true);
        return;
      }
      if ((e.key === "[" || e.key === "]") && currentPeriod) {
        const next = shiftPeriod(currentPeriod, e.key === "]" ? 1 : -1);
        if (periods.includes(next)) setPeriod(next);
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
          router.push(wsPath(ws, item.path));
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [currentPeriod, onOpenChange, periods, router, setPeriod, ws]);


  // Debounced record search (read-only route → lib/data.search)
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/w/${ws}/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setResults(res.ok ? ((await res.json()) as { results: SearchResult[] }).results : []);
      } catch {
        /* aborted or offline: keep previous results */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, ws]);

  const grouped = React.useMemo(() => {
    const map = new Map<SearchResult["kind"], SearchResult[]>();
    if (query.trim().length < 2) return [];
    for (const r of results) map.set(r.kind, [...(map.get(r.kind) ?? []), r]);
    return [...map.entries()];
  }, [results, query]);

  const openRecord = (r: SearchResult) => {
    pushRecent(r);
    go(r.href);
  };

  const ctx = React.useMemo(() => ({ open: () => onOpenChange(true) }), [onOpenChange]);

  return (
    <CommandMenuContext.Provider value={ctx}>
      {children}
      <CommandDialog open={open} onOpenChange={onOpenChange} title="Command menu" description="Search records, jump to a screen or run an action.">
        <CommandInput placeholder="Search transactions, bills, categories… or type a command" value={query} onValueChange={setQuery} />
        <CommandList className="max-h-[min(420px,60vh)]">
          <CommandEmpty>{loading ? "Searching…" : "No results."}</CommandEmpty>

          {query.trim().length < 2 && recents.length > 0 && (
            <CommandGroup heading="Recent">
              {recents.map((r) => (
                <ResultItem key={`recent-${r.id}`} r={r} onSelect={() => openRecord(r)} recent />
              ))}
            </CommandGroup>
          )}

          {grouped.map(([kind, items]) => (
            <CommandGroup key={kind} heading={KIND_LABEL[kind]} forceMount>
              {items.map((r) => (
                <ResultItem key={r.id} r={r} onSelect={() => openRecord(r)} />
              ))}
            </CommandGroup>
          ))}

          {grouped.length > 0 && <CommandSeparator />}

          <CommandGroup heading="Actions">
            <CommandItem value="upload actuals csv import transactions" onSelect={() => go(wsPath(ws, "/import?type=actual"))}>
              <UploadIcon />
              Upload actuals CSV
              <CommandShortcut>⌘U</CommandShortcut>
            </CommandItem>
            <CommandItem value="upload budget csv import planned" onSelect={() => go(wsPath(ws, "/import?type=budget"))}>
              <UploadIcon />
              Upload budget CSV
            </CommandItem>
            <CommandItem value="upload bill receipt pdf document factura" onSelect={() => go(wsPath(ws, "/documents?upload=1"))}>
              <FileTextIcon />
              Upload a bill (PDF)
            </CommandItem>
            <CommandItem
              value="copy mcp url connect ai assistant"
              onSelect={async () => {
                setOpen(false);
                try {
                  await navigator.clipboard.writeText(mcpUrl);
                  toast.success("MCP URL copied", { description: "Paste it into Grok, Claude or ChatGPT." });
                } catch {
                  toast.error("Couldn't copy. Open Connect AI to copy it manually.");
                }
              }}
            >
              <ClipboardCopyIcon />
              Copy MCP URL
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Go to">
            {NAV.map((n) => (
              <CommandItem key={n.key} value={`${n.label} ${n.keywords.join(" ")}`} onSelect={() => go(wsPath(ws, n.path))}>
                <NavIcon nav={n.key} />
                {n.label}
                <CommandShortcut>G {n.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
            {SETTINGS_SECTIONS.filter((s) => s.key !== "general").map((s) => (
              <CommandItem key={s.key} value={`settings ${s.label} ${s.description}`} onSelect={() => go(wsPath(ws, `/settings/${s.key}`))}>
                <ArrowRightIcon />
                Settings › {s.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {periods.length > 0 && (
            <CommandGroup heading="Period">
              {periods.map((p) => (
                <CommandItem key={p} value={`period ${formatPeriod(p, true)} ${p}`} onSelect={() => { setOpen(false); setPeriod(p); }}>
                  <CalendarIcon />
                  {formatPeriod(p, true)}
                  {p === currentPeriod && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Theme">
            <CommandItem value="theme light mode" onSelect={() => { setTheme("light"); setOpen(false); }}>
              <SunIcon /> Light theme
            </CommandItem>
            <CommandItem value="theme dark mode" onSelect={() => { setTheme("dark"); setOpen(false); }}>
              <MoonIcon /> Dark theme
            </CommandItem>
            <CommandItem value="theme system auto" onSelect={() => { setTheme("system"); setOpen(false); }}>
              <MonitorIcon /> System theme
            </CommandItem>
            <CommandItem value="reset sample workspace danger" onSelect={() => go(wsPath(ws, "/settings/danger"))}>
              <RotateCcwIcon /> Reset sample workspace…
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans">↵</kbd> open</span>
          <span><kbd className="font-sans">esc</kbd> close</span>
          <span className="ml-auto">G then a letter jumps anywhere</span>
        </div>
      </CommandDialog>
    </CommandMenuContext.Provider>
  );
}

function ResultItem({ r, onSelect, recent }: { r: SearchResult; onSelect: () => void; recent?: boolean }) {
  const Icon = recent ? HistoryIcon : KIND_ICON[r.kind];
  return (
    <CommandItem value={`${r.kind} ${r.id} ${r.title} ${r.subtitle}`} onSelect={onSelect}>
      <Icon />
      <span className="min-w-0 flex-1 truncate">
        {r.title}
        <span className="ml-2 text-muted-foreground">{r.subtitle}</span>
      </span>
      {r.amountMinor && r.currency && <span className="num ml-2 text-xs text-muted-foreground">{formatMinor(r.amountMinor, r.currency)}</span>}
    </CommandItem>
  );
}
