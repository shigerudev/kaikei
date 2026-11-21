/**
 * Acceptance runner (owner: Deyane). Runs SCOPE_AND_TASKS §5.2 AC1–AC7 against a FRESH sample
 * workspace and prints pass / fail. Used at checkpoint C2 and at code freeze.
 * Usage: npm run acceptance
 */
import "dotenv/config";
import golden from "../fixtures/golden.json" with { type: "json" };

type Check = { id: string; name: string; run: () => Promise<void> };

const pending = (id: string) => async () => {
  throw new Error(`${id} not implemented yet (owner: Deyane)`);
};

const checks: Check[] = [
  { id: "AC1", name: "Actual CSV import → Deliveries 330000 / +30000", run: pending("AC1") },
  { id: "AC2", name: "Budget CSV import + supersede", run: pending("AC2") },
  { id: "AC3", name: "Mapping review requires owner choice when ambiguous", run: pending("AC3") },
  { id: "AC4", name: "Repeat import, same file → 0 new", run: pending("AC4") },
  { id: "AC5", name: "Overlapping export → +1 transaction", run: pending("AC5") },
  { id: "AC6", name: "Located parse_error flag", run: pending("AC6") },
  { id: "AC7", name: "PDF extraction + match + confirm", run: pending("AC7") },
];

async function main() {
  void golden; // assertions compare engine output to these hand-computed figures
  let failed = 0;
  for (const c of checks) {
    try {
      await c.run();
      console.log(`✅ ${c.id} ${c.name}`);
    } catch (err) {
      failed++;
      console.log(`❌ ${c.id} ${c.name} — ${(err as Error).message}`);
    }
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
}

main();
