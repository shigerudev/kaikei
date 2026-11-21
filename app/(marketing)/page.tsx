import { ArrowRightIcon, FileStackIcon, GitMergeIcon, ScanSearchIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const GROUP = "grupo-ag";

/** Screen 0: landing (owner: Jordi). One line of value, then straight into the group. */
export default function LandingPage() {
  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[11px] text-background">K</span>
          Kaikei
        </span>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/g/${GROUP}`}>Open app</Link>
        </Button>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-20">
        <div className="space-y-5">
          <p className="enter inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand" /> Multi-company budget consolidation
          </p>
          <h1 className="enter text-4xl font-semibold tracking-tight text-balance sm:text-5xl" style={{ "--i": 1 } as React.CSSProperties}>
            Six budgets. One group number you can defend.
          </h1>
          <p className="enter max-w-xl text-lg text-pretty text-muted-foreground" style={{ "--i": 2 } as React.CSSProperties}>
            Kaikei consolidates every company&apos;s pack into one reporting currency, eliminates intercompany flows, catches errors before they reach a total, and
            traces each figure back to the exact source cell.
          </p>
        </div>
        <div className="enter flex flex-wrap gap-3" style={{ "--i": 3 } as React.CSSProperties}>
          <Button size="lg" variant="brand" asChild>
            <Link href={`/g/${GROUP}`}>
              Open Grupo AG <ArrowRightIcon />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href={`/g/${GROUP}/uploads`}>Upload company packs</Link>
          </Button>
        </div>
        <ul className="enter grid gap-4 pt-6 text-sm sm:grid-cols-3" style={{ "--i": 4 } as React.CSSProperties}>
          <li className="space-y-1.5">
            <FileStackIcon className="size-4 text-brand" />
            <p className="font-medium">Any shape in</p>
            <p className="text-muted-foreground">Long, wide, Debit/Credit, decimal comma — normalized and kept raw.</p>
          </li>
          <li className="space-y-1.5">
            <GitMergeIcon className="size-4 text-brand" />
            <p className="font-medium">No double counting</p>
            <p className="text-muted-foreground">Intercompany pairs matched and eliminated with balanced journals.</p>
          </li>
          <li className="space-y-1.5">
            <ScanSearchIcon className="size-4 text-brand" />
            <p className="font-medium">Every number traced</p>
            <p className="text-muted-foreground">From consolidated fact to rate, journal and source cell.</p>
          </li>
        </ul>
      </section>
    </main>
  );
}
