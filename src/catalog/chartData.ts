import type { Metric, Observation } from "./types";
import { comparisonKey, isComparable, metricLabel, scopeOf } from "./evidence";

export interface ScoreBar {
  id: string;
  label: string;
  detail?: string | null;
  title?: string;
  value: number;
}
export interface ResultTable {
  key: string;
  metric: Metric;
  observation: Observation;
  rows: { observation: Observation; metric: Metric }[];
}

/** Group rows into published result tables, keeping only reported numeric values. */
export function resultTables(observations: Observation[]) {
  const tables = new Map<string, ResultTable>();
  for (const o of observations)
    for (const m of o.metrics) {
      if (!isComparable(o, m)) continue;
      const key = comparisonKey(o, m);
      if (!tables.has(key))
        tables.set(key, { key, metric: m, observation: o, rows: [] });
      tables.get(key)!.rows.push({ observation: o, metric: m });
    }
  return [...tables.values()].filter((t) =>
    t.rows.some((r) => numeric(r.metric) != null),
  );
}
export function numeric(m: Metric) {
  const n = m.value == null ? NaN : Number(m.value);
  return Number.isFinite(n) ? n : null;
}
const ALL = new Set(['"all"', '"overall"']);
const text = (json: string) => {
  const v = JSON.parse(json);
  return typeof v === "string" ? v : json;
};
/**
 * The measured scope that tells tables apart, e.g. "Coding · code_completion". Placeholder
 * values ("all") and the scope/aggregation kind are only used when nothing else differs.
 */
function scopeLabels(tables: ResultTable[]) {
  const scopes = tables.map((t) => new Map(scopeOf(t.observation)));
  const keys = [...new Set(scopes.flatMap((s) => [...s.keys()]))].filter(
    (k) => new Set(scopes.map((s) => s.get(k))).size > 1,
  );
  const named = keys.filter((k) => k !== "scope" && k !== "aggregation");
  return scopes.map((s) => {
    const parts = named.map((k) => s.get(k)).filter((v): v is string => !!v && !ALL.has(v));
    if (parts.length) return parts.map(text).join(" · ");
    const fallback = keys.map((k) => s.get(k)).find((v) => v != null);
    return fallback ? text(fallback)[0].toUpperCase() + text(fallback).slice(1) : "";
  });
}
/** Chip labels stay unique by adding only the scope detail that differs. */
export function tableLabels(tables: ResultTable[]) {
  const metrics = new Set(tables.map((t) => t.metric.metricId)).size > 1;
  const scopes = scopeLabels(tables);
  const base = tables.map((t, i) =>
    [metrics || !scopes[i] ? metricLabel(t.metric) : null, t.metric.category, t.metric.subset, scopes[i]]
      .filter(Boolean)
      .join(" · "),
  );
  return tables.map((t, i) => {
    if (base.filter((b) => b === base[i]).length === 1) return base[i];
    const versions = new Set(
      tables.filter((_, j) => base[j] === base[i]).map((x) => x.observation.version),
    );
    return versions.size > 1
      ? `${base[i]} · ${t.observation.version ?? "version unknown"}`
      : `${base[i]} · snapshot #${t.observation.sourceSnapshotId}`;
  });
}
/** Broad tables (fewest specific scope values) first, then by label, so "Overall" leads. */
export function orderTables(tables: ResultTable[]) {
  const labels = tableLabels(tables);
  const depth = (t: ResultTable) =>
    scopeOf(t.observation).filter(([k, v]) => k !== "scope" && k !== "aggregation" && !ALL.has(v))
      .length;
  return tables
    .map((t, i) => ({ t, label: labels[i], broad: depth(t) === 0 ? 0 : 1 }))
    .sort((a, b) => a.broad - b.broad || (a.broad ? a.label.localeCompare(b.label) : 0))
    .map(({ t, label }) => ({ table: t, label }));
}
