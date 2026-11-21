/**
 * Single source for group navigation (sidebar, ⌘K, G-shortcuts, breadcrumbs) — MANIFESTO §3.2 screens.
 */
export type NavKey = "dashboard" | "uploads" | "runs" | "findings" | "intercompany" | "settings";

export type NavItem = { key: NavKey; label: string; path: string; shortcut: string; keywords: string[]; section: "main" | "footer" };

export const NAV: NavItem[] = [
  { key: "dashboard", label: "Panel", path: "", shortcut: "D", keywords: ["consolidated", "p&l", "balance", "overview", "facts"], section: "main" },
  { key: "uploads", label: "Cargas", path: "/uploads", shortcut: "U", keywords: ["files", "packs", "mapping", "import", "ingest"], section: "main" },
  { key: "runs", label: "Ejecuciones", path: "/runs", shortcut: "R", keywords: ["consolidation", "fingerprint", "publish", "stages"], section: "main" },
  { key: "findings", label: "Hallazgos", path: "/findings", shortcut: "F", keywords: ["errors", "validation", "blockers", "warnings"], section: "main" },
  { key: "intercompany", label: "Intercompañía", path: "/intercompany", shortcut: "I", keywords: ["ic", "eliminations", "journals", "matches", "reconciliation"], section: "main" },
  { key: "settings", label: "Configuración", path: "/settings/entities", shortcut: "S", keywords: ["configuration", "entities", "rates", "fx", "aliases", "parameters"], section: "footer" },
];

export const SETTINGS_SECTIONS = [
  { key: "entities", label: "Entidades", description: "Empresas, monedas funcionales, participación y alias de contraparte" },
  { key: "rates", label: "Tipos de cambio", description: "El juego único y versionado de tasas del grupo" },
  { key: "parameters", label: "Parámetros", description: "Moneda de reporte, tolerancia IC, WACC y tasas de impuesto" },
  { key: "appearance", label: "Apariencia", description: "Tema" },
  { key: "danger", label: "Datos de ejemplo", description: "Restablecer el espacio de ejemplo" },
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
