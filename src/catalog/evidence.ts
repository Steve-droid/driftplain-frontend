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
/**
 * One source result table: rows the same evaluator published in one snapshot for one
 * benchmark version and metric scope. Per-row run settings (such as effort) differ inside
 * a table and stay visible on each row; unknown provenance never joins a table.
 */
/**
 * Protocol settings that say *what* was measured (a task, split or aggregate), not how a
 * model was run. Rows that differ in one of these are separate tables and never share a chart.
 */
export const SCOPE_KEYS = [
  "scope",
  "category",
  "task",
  "subset",
  "split",
  "set",
  "dataset",
  "modality",
  "mode",
  "aggregation",
];
/** The measured-scope settings of a row, in SCOPE_KEYS order. */
export function scopeOf(o: Observation) {
  const config = o.protocolConfiguration ?? {};
  return SCOPE_KEYS.filter((k) => config[k] !== undefined).map(
    (k) => [k, JSON.stringify(config[k])] as const,
  );
}
export function comparisonKey(o: Observation, m: Metric) {
  const known =
    o.versionId != null &&
    o.evaluatorId != null &&
    o.sourceSnapshotId != null &&
    o.provenanceStatus === "complete" &&
    m.unit != null &&
    m.direction != null;
  return JSON.stringify([
    o.benchmarkId,
    o.versionId,
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
    scopeOf(o),
    known ? null : o.id,
  ]);
}
export function isComparable(o: Observation, m: Metric) {
  return !JSON.parse(comparisonKey(o, m)).at(-1);
}
/** Snake-case metric keys read as sentences; published display names stay untouched. */
export function metricLabel(m: Metric) {
  if (!/^[a-z0-9_]+$/.test(m.name)) return m.name;
  const words = m.name
    .split("_")
    .map((w) => (["usd", "ci", "pr"].includes(w) ? w.toUpperCase() : w))
    .join(" ");
  return words[0].toUpperCase() + words.slice(1);
}
/** Compact value for chart labels; tables keep the exact formatMetric value. */
export function shortValue(value: number, unit: string | null) {
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  const n = value.toLocaleString("en-US", { maximumFractionDigits: digits });
  if (unit === "percent") return `${n}%`;
  if (unit === "USD") return `$${n}`;
  return unit && unit !== "ratio" ? `${n} ${unit}` : n;
}
export function directionLabel(m: Metric) {
  return m.direction === "higher"
    ? "Higher is better"
    : m.direction === "lower"
      ? "Lower is better"
      : "Not ranked";
}
/** The effort/reasoning setting that distinguishes rows of one published table. */
const EFFORT_KEYS = ["effort", "reasoning_effort", "reasoningEffort"];
/** Keys that restate which model or submission a row is; the bar label already says that. */
const IDENTITY_KEY = /model|submission|provider_route/i;
const scalar = (v: unknown) =>
  typeof v === "boolean" ||
  typeof v === "number" ||
  (typeof v === "string" && v.length <= 24 && !/^[a-z]+:/i.test(v));
function settingText(key: string, value: unknown) {
  if (EFFORT_KEYS.includes(key)) return `${value} effort`;
  const name = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  if (typeof value === "boolean") return value ? name : `no ${name}`;
  return `${name} ${value}`;
}
/**
 * Short run-setting labels for rows of one published table: effort always, plus any other
 * simple protocol setting whose value differs between the rows (for example tools on/off).
 */
export function runSettings(observations: Observation[]) {
  const configs = observations.map((o) => o.protocolConfiguration ?? {});
  const keys = [...new Set(configs.flatMap((c) => Object.keys(c)))].filter(
    (k) =>
      EFFORT_KEYS.includes(k) ||
      (!IDENTITY_KEY.test(k) &&
        !SCOPE_KEYS.includes(k) &&
        configs.every((c) => c[k] === undefined || scalar(c[k])) &&
        new Set(configs.map((c) => JSON.stringify(c[k]))).size > 1),
  );
  keys.sort((a, b) => Number(EFFORT_KEYS.includes(b)) - Number(EFFORT_KEYS.includes(a)));
  return new Map(
    observations.map((o, i) => {
      const parts = keys
        .filter((k) => scalar(configs[i][k]))
        .map((k) => settingText(k, configs[i][k]));
      return [o.id, parts.length ? parts.join(" · ") : null] as const;
    }),
  );
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
/** Plain-language meaning of common published metrics; a stored description wins. */
const METRIC_MEANINGS: Record<string, string> = {
  pass_at_1: "Percentage of problems solved correctly on the first attempt.",
  task_accuracy: "Percentage of tasks solved correctly.",
  accuracy: "Percentage of questions or problems answered correctly.",
  overall_accuracy: "Percentage of questions answered correctly across all subjects.",
  average_score:
    "Average of the benchmark's automatically graded task scores, each from 0 to 100%.",
  resolved:
    "Percentage of GitHub issues whose generated patch made the benchmark's tests pass.",
  verified_task_success: "Percentage of tasks whose result passed the benchmark's verification.",
  task_success_rate: "Percentage of tasks completed successfully.",
  success_rate: "Percentage of tasks completed successfully.",
  precision: "Of the issues the model reported, the percentage that were real.",
  recall: "Of the real issues in the benchmark, the percentage the model found.",
  f1: "Balance of precision and recall: finding real issues without raising false ones.",
  calibration_error: "Gap between the model's stated confidence and its actual accuracy.",
  mean_cost_usd: "Average cost per task, in US dollars.",
  mean_output_tokens: "Average number of output tokens per task.",
  mean_agent_steps: "Average number of agent steps per task.",
};
export function metricMeaning(m: Metric) {
  if (m.description) return m.description;
  if (METRIC_MEANINGS[m.key]) return METRIC_MEANINGS[m.key];
  if (m.unit === "percent") return "Score published by the source, as a percentage.";
  if (m.unit === "ratio") return "Score published by the source, from 0 to 1.";
  return m.unit ? `Value published by the source, in ${m.unit}.` : "Value published by the source.";
}
