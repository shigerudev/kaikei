import { ArrowRightIcon, FileSpreadsheetIcon, FileTextIcon, PlugZapIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Screen 1: Landing / Trial (owner: Jordi). One line of value, then straight into the product.
 * TODO(Antonio + Jose): "Use your own file" should create a fresh empty workspace via POST /api/trial.
 */
export default function LandingPage() {
  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[11px] text-background">K</span>
          Kaikei
        </span>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/w/demo">Open app</Link>
        </Button>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-20">
        <div className="space-y-5">
          <p className="enter inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand" /> Accounting workspace for small businesses
          </p>
          <h1 className="enter text-4xl font-semibold tracking-tight text-balance sm:text-5xl" style={{ "--i": 1 } as React.CSSProperties}>
            Every number opens down to the row.
          </h1>
          <p className="enter max-w-xl text-lg text-pretty text-muted-foreground" style={{ "--i": 2 } as React.CSSProperties}>
            See why a figure changed and click through to the CSV row and the bill behind it. Your AI assistant gets the same answer from the same records.
          </p>
        </div>
        <div className="enter flex flex-wrap gap-3" style={{ "--i": 3 } as React.CSSProperties}>
          <Button size="lg" variant="brand" asChild>
            <Link href="/w/demo">
              Try the sample <ArrowRightIcon />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/w/demo/import">Use your own file</Link>
          </Button>
        </div>
        <ul className="enter grid gap-4 pt-6 text-sm sm:grid-cols-3" style={{ "--i": 4 } as React.CSSProperties}>
          <li className="space-y-1.5">
            <FileSpreadsheetIcon className="size-4 text-brand" />
            <p className="font-medium">Budget vs actual</p>
            <p className="text-muted-foreground">Upload exports; repeats count once.</p>
          </li>
          <li className="space-y-1.5">
            <FileTextIcon className="size-4 text-brand" />
            <p className="font-medium">Bills as evidence</p>
            <p className="text-muted-foreground">Match a PDF to its transaction.</p>
          </li>
          <li className="space-y-1.5">
            <PlugZapIcon className="size-4 text-brand" />
            <p className="font-medium">Ask your AI</p>
            <p className="text-muted-foreground">Grok, Claude, ChatGPT via MCP.</p>
          </li>
        </ul>
      </section>
    </main>
  );
}
