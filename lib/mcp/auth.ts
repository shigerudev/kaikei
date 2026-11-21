/**
 * PIPER-84: map the MCP path token to a group id. Unknown tokens must 404.
 * Demo default is a path secret, not a login. Override in env for anything beyond localhost.
 */
export const DEFAULT_DEMO_TOKEN = "demo-mcp-token";
export const PREVIEW_GROUP_ID = "demo";

export type EnvLike = Record<string, string | undefined>;

export function resolveGroupId(token: string, env: EnvLike = process.env): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const demo = env.MCP_DEMO_TOKEN?.trim() || DEFAULT_DEMO_TOKEN;
  if (trimmed === demo) return PREVIEW_GROUP_ID;

  const extra = env.MCP_GROUP_TOKENS ?? "";
  for (const part of extra.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const t = part.slice(0, idx).trim();
    const groupId = part.slice(idx + 1).trim();
    if (t && groupId && t === trimmed) return groupId;
  }
  return null;
}

/** Preview (no engine URL) may serve labelled non-PUBLISHED runs so Grok can be wired before publish exists. */
export function allowUnpublished(env: EnvLike = process.env): boolean {
  const flag = env.MCP_ALLOW_UNPUBLISHED?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !env.KAIKEI_API_URL;
}
