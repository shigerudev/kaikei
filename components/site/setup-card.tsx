"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { type ClientId, clients } from "@/components/site/clients";
import type { Dict } from "@/components/site/dict";
import { cn } from "@/lib/utils";

function Mark({ path, color, className }: { path: string; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("fill-current", className)} style={color ? { color } : undefined}>
      <path d={path} />
    </svg>
  );
}

/** "Paste in your assistant": pick a client, copy one prompt that connects kaikei's read-only MCP. */
export function SetupCard({ t }: { t: Dict["setup"] }) {
  const [client, setClient] = useState<ClientId>("claude");
  const [copied, setCopied] = useState(false);
  const active = clients.find((c) => c.id === client) ?? clients[0];
  const prompt = client === "cursor" ? t.cursorPrompt : t.chatPrompt;

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  };

  return (
    <div className="border-[3px] border-ink">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-[3px] border-ink px-4 py-3 md:px-5">
        <p className="font-display text-lg font-medium">{t.title}</p>
        <div role="tablist" aria-label={t.title} className="flex gap-1">
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === client}
              aria-label={c.name}
              title={c.name}
              onClick={() => setClient(c.id)}
              className={cn(
                "grid size-9 place-items-center transition-[background-color,box-shadow] duration-150",
                c.id === client ? "bg-beige shadow-[inset_0_0_0_2px_var(--ink)]" : "hover:bg-ink/10",
              )}
            >
              <Mark path={c.path} color={c.color} className="size-[18px]" />
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={copy} className="group flex w-full items-center gap-3 bg-ink px-4 py-3.5 text-left text-beige transition-colors hover:bg-ink/90 md:px-5">
        <span className="flex -space-x-1">
          {clients.map((c) => (
            <span key={c.id} className="grid size-7 place-items-center rounded-full bg-beige ring-2 ring-ink">
              <Mark path={c.path} color={c.color ?? "var(--ink)"} className="size-3.5" />
            </span>
          ))}
        </span>
        <span className="flex-1 font-medium">{copied ? t.copied : t.copy}</span>
        {copied ? <CheckIcon className="size-4" aria-hidden /> : <CopyIcon className="size-4 transition-transform group-active:scale-90" aria-hidden />}
      </button>

      <div className="px-4 py-4 md:px-5">
        <p className="flex items-center gap-2 t-small font-semibold">
          <Mark path={active.path} color={active.color} className="size-4" />
          {t.pasteIn} {active.name}
        </p>
        <p className="t-small mt-1 text-ink/75">{t.steps[client]}</p>
        <pre className="mt-3 max-h-56 overflow-auto bg-ink/[0.06] p-4 font-mono text-[12.5px] leading-5 whitespace-pre-wrap text-ink/90 [overflow-wrap:anywhere]">
          {prompt}
        </pre>
        <p className="t-small mt-3 text-ink/70">
          {t.token} {t.free}
        </p>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? t.copied : ""}
      </span>
    </div>
  );
}
