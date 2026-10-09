import { describe, expect, it } from "vitest";
import {
  comparisonKey,
  formatMetric,
  metricLabel,
  metricMeaning,
  parseChoices,
  runSettings,
  safeUrl,
  shortValue,
} from "./evidence";
import { observation } from "./fixtures";
import { orderTables, resultTables } from "./chartData";

describe("public evidence contracts", () => {
  it("distinguishes null, zero, ratios, cost and unknown units", () => {
    const m = observation.metrics[0];
    expect(formatMetric({ ...m, value: null })).toBe("Not reported");
    expect(formatMetric({ ...m, value: "0" })).toBe("0%");
    expect(formatMetric({ ...m, value: "0.5", unit: "ratio" })).toBe(
      "0.5 ratio",
    );
    expect(formatMetric({ ...m, value: "1.2", unit: "USD" })).toBe("1.2 USD");
    expect(formatMetric({ ...m, value: "42", unit: null })).toBe(
      "42 (unit unknown)",
    );
  });
  it("groups one published table across per-row run settings", () => {
    const m = observation.metrics[0];
    expect(comparisonKey({ ...observation, id: 2, protocolId: 2 }, m)).toBe(
      comparisonKey(observation, m),
    );
  });
  it("never merges unknown or different snapshot/version/evaluator/metric scopes", () => {
    const m = observation.metrics[0];
    const key = comparisonKey(observation, m);
    for (const change of [
      { sourceSnapshotId: 2 },
      { versionId: 2 },
      { evaluatorId: 2 },
      { provenanceStatus: "incomplete" as const },
      { versionId: null },
      { evaluatorId: null },
    ]) {
      expect(comparisonKey({ ...observation, ...change }, m)).not.toBe(key);
    }
    expect(comparisonKey(observation, { ...m, subset: "hard" })).not.toBe(key);
    expect(comparisonKey({ ...observation, versionId: null }, m)).not.toBe(
      comparisonKey({ ...observation, id: 999, versionId: null }, m),
    );
  });
  it("labels metric keys and compact chart values without changing units", () => {
    const m = observation.metrics[0];
    expect(metricLabel({ ...m, name: "mean_cost_usd" })).toBe("Mean cost USD");
    expect(metricLabel({ ...m, name: "Pass@1" })).toBe("Pass@1");
    expect(shortValue(57.912, "percent")).toBe("57.9%");
    expect(shortValue(4.429, "USD")).toBe("$4.43");
    expect(shortValue(29557.3, "tokens")).toBe("29,557 tokens");
    expect(shortValue(0.42, "ratio")).toBe("0.42");
  });
  it("preserves distinct canonical and unresolved choices, bounds malformed URLs", () => {
    expect(parseChoices("m1,o12,m1,m2,m3,m4")).toEqual([
      "m1",
      "o12",
      "m2",
      "m3",
    ]);
    expect(parseChoices("m0,m-1,m2x,o3.5,undefined")).toEqual([]);
  });
  it("links only web citations, never executable or internal artifact URIs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("urn:sha256:abc")).toBeUndefined();
    expect(safeUrl("https://example.org/paper")).toBe(
      "https://example.org/paper",
    );
  });
  it("labels bars with effort and only the settings that differ", () => {
    const row = (id: number, config: Record<string, unknown>) => ({
      ...observation,
      id,
      protocolConfiguration: { year: 2025, scope: "https://example.org/x", ...config },
    });
    const labels = runSettings([
      row(1, { tools: false, effort: "high" }),
      row(2, { tools: true, effort: "high" }),
      row(3, { tools: true, effort: "low" }),
    ]);
    expect([...labels.values()]).toEqual([
      "high effort · no tools",
      "high effort · tools",
      "low effort · tools",
    ]);
    expect(runSettings([row(4, {}), row(5, {})]).get(4)).toBeNull();
  });
  it("never charts overall, category and task scores together", () => {
    const m = observation.metrics[0];
    const row = (id: number, scope: string, category: string, task: string) => ({
      ...observation,
      id,
      protocolConfiguration: { scope, category, task, model_configuration: `m${id}` },
    });
    const rows = [
      row(1, "task", "Coding", "code_completion"),
      row(2, "overall", "all", "all"),
      row(3, "category", "Coding", "all"),
      row(4, "overall", "all", "all"),
    ];
    expect(comparisonKey(rows[1], m)).toBe(comparisonKey(rows[3], m));
    expect(comparisonKey(rows[0], m)).not.toBe(comparisonKey(rows[2], m));
    const tables = orderTables(resultTables(rows));
    expect(tables.map((t) => t.label)).toEqual(["Overall", "Coding", "Coding · code_completion"]);
    expect(tables[0].table.rows).toHaveLength(2);
  });
  it("omits model-identity settings that repeat the bar label", () => {
    const row = (id: number, config: Record<string, unknown>) => ({
      ...observation,
      id,
      protocolConfiguration: config,
    });
    const labels = runSettings([
      row(1, { source_model_id: "A", submission: "s1", agent: "x" }),
      row(2, { source_model_id: "B", submission: "s2", agent: "y" }),
    ]);
    expect([...labels.values()]).toEqual(["agent x", "agent y"]);
  });
  it("explains what a plotted number means", () => {
    const m = observation.metrics[0];
    expect(metricMeaning({ ...m, key: "pass_at_1", description: null })).toMatch(/first attempt/);
    expect(metricMeaning({ ...m, key: "x", description: "Stored." })).toBe("Stored.");
    expect(metricMeaning({ ...m, key: "x", description: null, unit: "percent" })).toMatch(
      /percentage/,
    );
  });
});
