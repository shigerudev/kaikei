import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

export type Workspace = typeof schema.workspaces.$inferSelect;

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  const [ws] = await db().select().from(schema.workspaces).where(eq(schema.workspaces.id, id));
  return ws;
}

export async function getWorkspaceByMcpToken(token: string): Promise<Workspace | undefined> {
  const [ws] = await db()
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.mcpToken, token));
  return ws;
}

/** Deep links used in MCP `app_url` and `source_refs`. Keep in sync with app/w/[ws]/ routes. */
export const appUrl = {
  overview: (ws: string, period?: string) =>
    `${env().APP_URL}/w/${ws}${period ? `?period=${period}` : ""}`,
  figure: (ws: string, period: string, category: string, currency: string) =>
    `${env().APP_URL}/w/${ws}/figure/${period}/${encodeURIComponent(category)}/${currency}`,
  transaction: (ws: string, txId: string) => `${env().APP_URL}/w/${ws}/transactions/${txId}`,
  document: (ws: string, docId: string) => `${env().APP_URL}/w/${ws}/documents/${docId}`,
  review: (ws: string) => `${env().APP_URL}/w/${ws}/review`,
};
