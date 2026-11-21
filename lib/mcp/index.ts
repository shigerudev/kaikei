/**
 * K9 MCP surface (Hugo): bilingual copy + parity helpers.
 * Route wiring lives in app/api/mcp/[token] (Antonio / PIPER-84).
 */
export {
  CONSOLIDATION_TOOL_COPY,
  CONSOLIDATION_WALKTHROUGH_EN,
  CONSOLIDATION_WALKTHROUGH_ES,
  FORBIDDEN_MUTATING_TOOL_NAMES,
  READONLY_TOOL_NAMES,
  assertNoMutatingTools,
  bilingual,
  type ConsolidationToolName,
  type ToolCopy,
  type ToolParam,
} from "./consolidation-copy";
