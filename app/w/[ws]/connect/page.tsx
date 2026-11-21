import { LockIcon, MessageSquareQuoteIcon, ShieldCheckIcon } from "lucide-react";
import { CopyField } from "@/components/copy-field";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWorkspaceInfo } from "@/lib/data";

export const metadata = { title: "Connect AI" };

const CLIENTS = [
  {
    key: "grok",
    name: "Grok",
    steps: ["Open Grok and go to Settings → Connectors (MCP).", "Add a remote MCP server and paste your Kaikei URL.", "Start a new chat and ask about your figures."],
  },
  {
    key: "claude",
    name: "Claude",
    steps: ["In Claude, open Settings → Connectors → Add custom connector.", "Paste your Kaikei URL as the server URL. No sign-in is needed.", "Enable the connector in a chat and ask your question."],
  },
  {
    key: "chatgpt",
    name: "ChatGPT",
    steps: ["Turn on Developer mode in ChatGPT settings, then open Connectors.", "Create a connector and paste your Kaikei URL.", "Select the connector in a new chat and ask your question."],
  },
];

const QUESTION = "¿Cuánto nos pasamos del presupuesto de entregas y qué comprobante respalda el último gasto?";

/** Connect AI: one read-only MCP endpoint per workspace; same figures as the app. */
export default async function ConnectPage({ params }: PageProps<"/w/[ws]/connect">) {
  const { ws } = await params;
  const info = await getWorkspaceInfo(ws);
  if (!info) return null;
  return (
    <>
      <PageHeader crumbs={[{ label: "Connect AI" }]} preview={info.dataSource === "preview"} />
      <PageBody className="max-w-3xl">
        <PageTitle title="Connect your AI assistant" description="Ask Grok, Claude or ChatGPT about your numbers. They read the same stored figures, period and sources you see here — they never calculate their own." />

        <section className="space-y-3 rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Your MCP URL</h2>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheckIcon className="size-3.5" /> Read-only
            </span>
          </div>
          <CopyField value={info.mcpUrl} label="MCP URL" masked />
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <LockIcon className="mt-0.5 size-3 shrink-0" /> Anyone with this URL can read this workspace. Rotate it in Settings › AI &amp; MCP if it leaks.
          </p>
        </section>

        <Tabs defaultValue="grok" className="gap-4">
          <TabsList>
            {CLIENTS.map((c) => (
              <TabsTrigger key={c.key} value={c.key}>{c.name}</TabsTrigger>
            ))}
          </TabsList>
          {CLIENTS.map((c) => (
            <TabsContent key={c.key} value={c.key}>
              <ol className="space-y-3">
                {c.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="num flex size-6 shrink-0 items-center justify-center rounded-full border text-xs text-muted-foreground">{i + 1}</span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            </TabsContent>
          ))}
        </Tabs>

        <section className="space-y-3 rounded-xl border bg-muted/30 p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <MessageSquareQuoteIcon className="size-4 text-brand" /> Try this question
          </h2>
          <CopyField value={QUESTION} label="sample question" mono={false} />
          <p className="text-xs text-muted-foreground">The answer should name the Deliveries variance and link to the latest delivery expense and its bill — the same records you can open from Overview.</p>
        </section>
      </PageBody>
    </>
  );
}
