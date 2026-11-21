import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSOLIDATION_TOOL_COPY } from "./consolidation-copy";
import { allowUnpublished, DEFAULT_DEMO_TOKEN, resolveGroupId } from "./auth";

test("unknown and empty tokens do not resolve", () => {
  assert.equal(resolveGroupId(""), null);
  assert.equal(resolveGroupId("   "), null);
  assert.equal(resolveGroupId("not-a-token"), null);
});

test("default demo token maps to grupo-ag", () => {
  assert.equal(resolveGroupId(DEFAULT_DEMO_TOKEN, {}), "grupo-ag");
});

test("MCP_DEMO_TOKEN overrides the default", () => {
  const env = { MCP_DEMO_TOKEN: "secret-from-ops" };
  assert.equal(resolveGroupId("secret-from-ops", env), "grupo-ag");
  assert.equal(resolveGroupId(DEFAULT_DEMO_TOKEN, env), null);
});

test("MCP_GROUP_TOKENS maps extra tokens", () => {
  const env = { MCP_GROUP_TOKENS: "aaa=grupo-ag,bbb=other" };
  assert.equal(resolveGroupId("aaa", env), "grupo-ag");
  assert.equal(resolveGroupId("bbb", env), "other");
});

test("unpublished reads are allowed in preview and denied when an engine URL is set", () => {
  assert.equal(allowUnpublished({}), true);
  assert.equal(allowUnpublished({ KAIKEI_API_URL: "https://app.kaikei.io/api" }), false);
  assert.equal(allowUnpublished({ KAIKEI_API_URL: "https://app.kaikei.io/api", MCP_ALLOW_UNPUBLISHED: "true" }), true);
  assert.equal(allowUnpublished({ MCP_ALLOW_UNPUBLISHED: "false" }), false);
});

test("Hugo copy keys are the five read-only K9 tools", () => {
  const names = Object.keys(CONSOLIDATION_TOOL_COPY).sort();
  assert.deepEqual(names, [
    "get_fact_lineage",
    "get_facts",
    "get_findings",
    "get_reconciliations",
    "get_run_status",
  ]);
});
