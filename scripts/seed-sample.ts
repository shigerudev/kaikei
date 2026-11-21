/**
 * Creates the seeded sample workspace "Panadería La Ceiba" from fixtures/ (owner: Antonio).
 * Usage: npm run seed
 *
 * Seed rows must go through the same ingest path as uploads (source_files → source_rows →
 * transactions/budget_lines) so drilldown reaches a raw row for every seeded figure.
 */
import "dotenv/config";

async function main() {
  // TODO(Antonio):
  // 1. insert workspace (is_sample = true, base_currency GTQ, random mcp_token)
  // 2. insert categories with aliases (Deliveries ↔ entregas, …)
  // 3. ingest the seed budget + actuals via lib/ingest
  // 4. print the workspace URL and MCP URL
  throw new Error("seed-sample not implemented yet (owner: Antonio)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
