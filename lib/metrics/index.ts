/**
 * K3 Metrics API (owner: Jose). THE single source of figures (Principles 1 + 2).
 * The UI and the MCP tools both call these functions and nothing else for numbers.
 *
 * Rules:
 * - Computed live from accepted records; do NOT add "use cache" here (figures must match `as_of`).
 * - Never sum across currencies. Variance = actual − budget for the same (period, category, currency).
 * - Bills and budgets never count as cash.
 * - Amounts leave this module as MinorString (decimal strings of minor units).
 *
 * OPEN (decide at contract lock): transactions store money-out as negative, but AC1 expects
 * Deliveries actual = 330000 and variance = +30000. Proposed: per-category figures report
 * spend as a positive magnitude for expense categories; cash.outMinor is also a positive magnitude.
 */
import type {
  AsOf,
  CashflowResult,
  OverviewResult,
  VarianceResult,
  WhatChangedResult,
} from "@/lib/types";
import { notImplemented } from "@/lib/not-implemented";

/** Latest applied import id + applied_at for the workspace. TODO(Jose) */
export async function getAsOf(workspaceId: string): Promise<AsOf> {
  void workspaceId;
  return notImplemented("metrics.getAsOf", "Jose");
}

/** TODO(Jose) */
export async function getOverview(workspaceId: string, period: string): Promise<OverviewResult> {
  void workspaceId;
  void period;
  return notImplemented("metrics.getOverview", "Jose");
}

/** Contributors are the transactions summing to `actualMinor`, latest first. TODO(Jose) */
export async function getVariance(
  workspaceId: string,
  period: string,
  category?: string,
  currency?: string,
): Promise<VarianceResult> {
  void workspaceId;
  void period;
  void category;
  void currency;
  return notImplemented("metrics.getVariance", "Jose");
}

/** Money in/out by month from actual transactions by transaction date. TODO(Jose) */
export async function getCashflow(
  workspaceId: string,
  from: string,
  to: string,
): Promise<CashflowResult> {
  void workspaceId;
  void from;
  void to;
  return notImplemented("metrics.getCashflow", "Jose");
}

/** Deltas from the latest (or given) import's `change_events`. TODO(Jose) */
export async function whatChanged(
  workspaceId: string,
  importId?: string,
): Promise<WhatChangedResult> {
  void workspaceId;
  void importId;
  return notImplemented("metrics.whatChanged", "Jose");
}
