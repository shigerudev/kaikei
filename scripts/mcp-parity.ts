/**
 * AC9 helper: print the 3-client parity table (default not_verified).
 * Usage: npx tsx scripts/mcp-parity.ts
 * After a live client run, fill tool minors and re-evaluate offline in tests.
 */
import {
  buildParityTemplate,
  DEMO_QUESTION_ES,
  expectedWalkthrough,
} from "../lib/mcp/parity";

const exp = expectedWalkthrough();
const rows = buildParityTemplate();

console.log("Demo question (ES):", DEMO_QUESTION_ES);
console.log("Expected (golden):", exp);
console.log("");
console.log("| client | status | expected actual | expected variance |");
console.log("|---|---|---|---|");
for (const r of rows) {
  console.log(
    `| ${r.client} | ${r.status} | ${r.expected_actual_minor} | ${r.expected_variance_minor} |`,
  );
}
console.log("\nPaste each client's tool JSON and mark pass/fail via evaluateParityRow in tests.");
