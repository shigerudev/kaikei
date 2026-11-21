/**
 * Single source for group navigation (sidebar, ⌘K, G-shortcuts, breadcrumbs) — MANIFESTO §3.2 screens.
 */
export type NavKey = "dashboard" | "uploads" | "runs" | "findings" | "intercompany" | "settings";

export type NavItem = { key: NavKey; label: string; path: string; shortcut: string; keywords: string[]; section: "main" | "footer" };

export const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", path: "", shortcut: "D", keywords: ["consolidated", "p&l", "balance", "overview", "facts"], section: "main" },
  { key: "uploads", label: "Uploads", path: "/uploads", shortcut: "U", keywords: ["files", "packs", "mapping", "import", "ingest"], section: "main" },
  { key: "runs", label: "Runs", path: "/runs", shortcut: "R", keywords: ["consolidation", "fingerprint", "publish", "stages"], section: "main" },
  { key: "findings", label: "Findings", path: "/findings", shortcut: "F", keywords: ["errors", "validation", "blockers", "warnings"], section: "main" },
  { key: "intercompany", label: "Intercompany", path: "/intercompany", shortcut: "I", keywords: ["ic", "eliminations", "journals", "matches", "reconciliation"], section: "main" },
  { key: "settings", label: "Group settings", path: "/settings/entities", shortcut: "S", keywords: ["configuration", "entities", "rates", "fx", "aliases", "parameters"], section: "footer" },
];

export const SETTINGS_SECTIONS = [
  { key: "entities", label: "Entities", description: "Companies, functional currencies, ownership and counterparty aliases" },
  { key: "rates", label: "Exchange rates", description: "The group's single, versioned rate set" },
  { key: "parameters", label: "Parameters", description: "Reporting currency, IC tolerance, WACC and tax rates" },
  { key: "appearance", label: "Appearance", description: "Theme" },
  { key: "danger", label: "Preview data", description: "Reset the in-memory preview" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["key"];

export const gPath = (group: string, path = "") => `/g/${group}${path}`;

export function activeNav(pathname: string, group: string): NavKey {
  const rest = pathname.replace(`/g/${group}`, "");
  if (rest.startsWith("/uploads")) return "uploads";
  if (rest.startsWith("/runs")) return "runs";
  if (rest.startsWith("/findings")) return "findings";
  if (rest.startsWith("/intercompany")) return "intercompany";
  if (rest.startsWith("/settings")) return "settings";
  return "dashboard";
}
