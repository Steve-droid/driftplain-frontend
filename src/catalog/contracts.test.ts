import { describe, expect, it } from "vitest";
import { comparisonKey, formatMetric, parseChoices, safeUrl } from "./evidence";
import { observation } from "./fixtures";

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
  it("never merges unknown or different protocol/snapshot/metric scopes", () => {
    const m = observation.metrics[0];
    const key = comparisonKey(observation, m);
    for (const change of [
      { protocolId: 2 },
      { sourceSnapshotId: 2 },
      { versionId: null },
      { evaluatorId: null },
    ]) {
      expect(comparisonKey({ ...observation, ...change }, m)).not.toBe(key);
    }
    expect(comparisonKey(observation, { ...m, subset: "hard" })).not.toBe(key);
    expect(comparisonKey({ ...observation, protocolId: null }, m)).not.toBe(
      comparisonKey({ ...observation, id: 999, protocolId: null }, m),
    );
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
});
