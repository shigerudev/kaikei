import { Button } from "@/components/ui/button";

/**
 * Screen 1: Landing / Trial (owner: Jordi).
 * TODO(Jordi): wire both buttons to POST /api/trial and redirect to /w/<id>;
 * sample downloads served from /public/samples (copied from fixtures/).
 */
export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-24">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Every number opens down to the row.</h1>
        <p className="text-lg text-muted-foreground">
          See why a figure changed and click through to the CSV row and the bill behind it.
          Your AI assistant gets the same answer from the same records.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" disabled>
          Try the sample
        </Button>
        <Button size="lg" variant="outline" disabled>
          Use your own file
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Sample files: sample_actuals_nov.csv · bill_transportes_rapidos.pdf (coming soon)
      </p>
    </main>
  );
}
