import type { Billing, UsageRun } from "./types";
import { formatDateTime } from "../lib/format";

// Pure chart transforms for the selected-run dashboard. Money strings stay exact in
// `costText`; the numeric `cost` exists only to size a bar. Unavailable and legacy costs
// are omitted (null), never drawn as zero, and nothing is compared against a baseline.

export interface RunPoint {
  id: number;
  label: string;
  fullDate: string;
  model: string | null;
}

const point = (r: UsageRun): RunPoint => ({
  id: r.id,
  label: r.jenkinsBuildId ?? `run ${r.id}`,
  fullDate: r.createdAt ? formatDateTime(r.createdAt) : "Date unavailable",
  model: r.model,
});

/** The API lists newest first; charts read left to right in time. */
export const chronological = (runs: UsageRun[]): UsageRun[] => [...runs].reverse();

export interface CostPoint extends RunPoint {
  cost: number | null;
  costText: string | null;
  status: Billing["status"];
  basis: string;
}

export const hasKnownCost = (runs: UsageRun[]): boolean =>
  runs.some((r) => r.billing.knownCost != null);

export function costSeries(runs: UsageRun[]): CostPoint[] {
  return chronological(runs).map((r) => {
    const known = r.billing.status !== "unavailable" && r.billing.knownCost != null;
    return {
      ...point(r),
      cost: known ? Number(r.billing.knownCost) : null,
      costText: known ? r.billing.knownCost : null,
      status: r.billing.status,
      basis: r.billing.basis,
    };
  });
}

// Priced billing categories in a stable order; anything else follows alphabetically.
const CATEGORY_ORDER = ["input", "output", "cache_read", "cache_write"];

export function tokenCategories(runs: UsageRun[]): string[] {
  const seen = new Set<string>();
  for (const r of runs)
    for (const c of r.billing.categories) if (c.tokens != null) seen.add(c.category);
  return [...seen].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
}

export type TokenPoint = RunPoint & Record<string, number | string | null>;

/** One bar group per run; an unknown count is left out of the point (no zero-fill). */
export function tokenSeries(runs: UsageRun[]): TokenPoint[] {
  return chronological(runs).map((r) => {
    const p: TokenPoint = { ...point(r) };
    for (const c of r.billing.categories) if (c.tokens != null) p[c.category] = c.tokens;
    return p;
  });
}

/** Sum of the priced billing categories with known counts; null when none is known. */
export function pricedTokens(run: UsageRun): number | null {
  let total: number | null = null;
  for (const c of run.billing.categories)
    if (c.tokens != null) total = (total ?? 0) + c.tokens;
  return total;
}

export interface FeedbackPoint extends RunPoint {
  accepted: number;
  rejected: number;
  unrated: number;
  total: number;
}

export const hasFeedback = (runs: UsageRun[]): boolean =>
  runs.some((r) => r.feedback.total > 0);

export function feedbackSeries(runs: UsageRun[]): FeedbackPoint[] {
  return chronological(runs).map((r) => ({
    ...point(r),
    accepted: r.feedback.accepted,
    rejected: r.feedback.rejected,
    unrated: Math.max(r.feedback.total - r.feedback.rated, 0),
    total: r.feedback.total,
  }));
}

/** Compact token counts for axis ticks: 850 · 1.2k · 45k · 1.3M. */
export function formatTokensAxis(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(1))}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${parseFloat((n / 1000).toFixed(1))}k`;
  return String(n);
}
