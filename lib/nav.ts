/**
 * Single source for workspace navigation (sidebar, ⌘K, G-shortcuts, breadcrumbs).
 * Keep in sync with app/w/[ws]/ routes and lib/workspaces.ts `appUrl`.
 */
export type NavKey = "overview" | "import" | "transactions" | "documents" | "review" | "connect" | "settings";

export type NavItem = { key: NavKey; label: string; path: string; shortcut: string; keywords: string[] };

export const NAV: NavItem[] = [
  { key: "overview", label: "Overview", path: "", shortcut: "O", keywords: ["dashboard", "home", "resumen", "budget", "variance"] },
  { key: "import", label: "Import", path: "/import", shortcut: "I", keywords: ["upload", "csv", "subir", "importar"] },
  { key: "transactions", label: "Transactions", path: "/transactions", shortcut: "T", keywords: ["transacciones", "gastos", "actuals"] },
  { key: "documents", label: "Documents", path: "/documents", shortcut: "D", keywords: ["bills", "receipts", "pdf", "facturas", "comprobantes"] },
  { key: "review", label: "Review", path: "/review", shortcut: "R", keywords: ["flags", "alerts", "alertas", "issues"] },
  { key: "connect", label: "Connect AI", path: "/connect", shortcut: "C", keywords: ["mcp", "grok", "claude", "chatgpt", "assistant"] },
  { key: "settings", label: "Settings", path: "/settings/general", shortcut: "S", keywords: ["preferences", "configuración", "ajustes"] },
];

export const SETTINGS_SECTIONS = [
  { key: "general", label: "General", description: "Workspace name, currency and defaults" },
  { key: "categories", label: "Categories", description: "Categories and the aliases that map to them" },
  { key: "ai", label: "AI & MCP", description: "Assistant access and AI suggestions" },
  { key: "appearance", label: "Appearance", description: "Theme" },
  { key: "danger", label: "Danger zone", description: "Reset the sample workspace" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["key"];

export const wsPath = (ws: string, path = "") => `/w/${ws}${path}`;

export function activeNav(pathname: string, ws: string): NavKey {
  const rest = pathname.replace(`/w/${ws}`, "");
  if (rest.startsWith("/import")) return "import";
  if (rest.startsWith("/transactions") || rest.startsWith("/figure")) return rest.startsWith("/figure") ? "overview" : "transactions";
  if (rest.startsWith("/documents")) return "documents";
  if (rest.startsWith("/review")) return "review";
  if (rest.startsWith("/connect")) return "connect";
  if (rest.startsWith("/settings")) return "settings";
  return "overview";
}
