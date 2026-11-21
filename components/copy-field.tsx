"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Read-only value with a copy button. The icon morphs copy → check with a short blur crossfade
 * (state indication), then settles back after 1.6s.
 */
export function CopyField({ value, label, mono = true, masked = false }: { value: string; label: string; mono?: boolean; masked?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [reveal, setReveal] = useState(!masked);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const shown = reveal ? value : value.replace(/[^/]+$/, (m) => "•".repeat(Math.min(m.length, 24)));

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-1.5 pl-3">
      <span aria-label={label} className={`min-w-0 flex-1 truncate text-sm ${mono ? "font-mono text-xs" : ""}`}>
        {shown}
      </span>
      {masked && (
        <Button variant="ghost" size="xs" onClick={() => setReveal((r) => !r)} className="text-muted-foreground">
          {reveal ? "Hide" : "Show"}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            toast.error("Couldn't copy. Select the text and copy it manually.");
          }
        }}
        className="relative w-20 overflow-hidden"
      >
        <span className={`flex items-center gap-1.5 transition-[opacity,filter,transform] duration-200 ease-(--ease-out) ${copied ? "scale-90 opacity-0 blur-[2px]" : ""}`}>
          <CopyIcon /> Copy
        </span>
        <span className={`absolute inset-0 flex items-center justify-center gap-1.5 text-brand transition-[opacity,filter,transform] duration-200 ease-(--ease-out) ${copied ? "" : "scale-90 opacity-0 blur-[2px]"}`}>
          <CheckIcon /> Copied
        </span>
      </Button>
    </div>
  );
}
