"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Workspace-level error boundary: plain-language message, retry, and a way home. */
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon className="size-5" />
      </span>
      <div className="space-y-1">
        <h1 className="font-medium">Something went wrong loading this view</h1>
        <p className="text-sm text-muted-foreground">Your data is safe — nothing was changed. Try again, or go back to the overview.</p>
        {error.digest && <p className="font-mono text-[11px] text-muted-foreground">Ref {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          <RotateCcwIcon /> Try again
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
