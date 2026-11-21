import { ScreenPlaceholder } from "@/components/screen-placeholder";

/** Connect AI panel. */
export default function ConnectPage() {
  return (
    <ScreenPlaceholder
      title="Connect your AI assistant"
      owner="Jordi (UI) · Antonio (setup steps)"
      purpose="Show the workspace MCP URL and copy-paste setup for Grok, Claude and ChatGPT."
      todo={[
        "MCP URL: <APP_URL>/api/mcp/<workspace.mcp_token> with a copy button",
        "Per-client setup steps (Grok first; Claude custom connector; ChatGPT developer mode)",
        "Note: read-only; the token is a secret for this workspace",
      ]}
    />
  );
}
