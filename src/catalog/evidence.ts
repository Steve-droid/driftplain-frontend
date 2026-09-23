import type { Metric, Observation } from "./types";
export function safeUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function parseChoices(raw: string | null) {
  return [
    ...new Set(
      (raw ?? "").split(",").filter((s) => /^[mo][1-9]\d{0,9}$/.test(s)),
    ),
  ].slice(0, 4);
}
export function formatMetric(metric: Metric) {
  if (metric.value == null || !Number.isFinite(Number(metric.value)))
    return "Not reported";
  const value = Number(metric.value).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
  return metric.unit === "percent"
    ? `${value}%`
    : `${value} ${metric.unit ?? "(unit unknown)"}`;
}
/** Deliberately conservative: unknown provenance cannot prove comparable settings. */
export function comparisonKey(o: Observation, m: Metric) {
  const known =
    o.versionId != null &&
    o.protocolId != null &&
    o.evaluatorId != null &&
    o.sourceSnapshotId != null &&
    o.provenanceStatus === "complete" &&
    m.unit != null &&
    m.direction != null;
  return JSON.stringify([
    o.benchmarkId,
    o.versionId,
    o.protocolId,
    o.evaluatorId,
    o.sourceSnapshotId,
    m.metricId,
    m.unit,
    m.direction,
    m.category,
    m.subset,
    m.aggregation,
    m.sampleSize,
    m.denominator,
    m.attempts,
    known ? null : o.id,
  ]);
}
export const collections: Record<string, string> = {
  reasoning_knowledge: "Reasoning & knowledge",
  mathematics: "Mathematics",
  coding_terminal: "Coding & terminal",
  long_context_computer_use: "Context & computer use",
  independent_community: "Independent evaluations",
  ci_specific: "CI tasks",
  task_related: "Task-related evidence",
};
export function collectionName(value: string | null) {
  return value
    ? (collections[value] ?? value.replaceAll("_", " "))
    : "Other evidence";
}
