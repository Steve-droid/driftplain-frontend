import { describe, expect, it } from "vitest";
import { usageFixture } from "./fixtures";
import {
  costSeries,
  feedbackSeries,
  formatTokensAxis,
  hasFeedback,
  hasKnownCost,
  pricedTokens,
  tokenCategories,
  tokenSeries,
} from "./chartData";
import type { UsageRun } from "./types";

const runs = usageFixture.runs;

describe("cost series", () => {
  it("reads oldest to newest and keeps the exact cost string beside the bar size", () => {
    const s = costSeries(runs);
    expect(s.map((p) => p.label)).toEqual(["aborted-13", "report-12"]);
    expect(s[1]).toMatchObject({ cost: 0.0012, costText: "0.0012", status: "complete" });
    expect(s[0]).toMatchObject({ cost: 0.0003, costText: "0.0003", status: "partial" });
  });

  it("omits unavailable and legacy costs instead of drawing zero", () => {
    const legacy: UsageRun = {
      ...runs[0],
      legacyCost: "1.25",
      billing: { ...runs[0].billing, status: "unavailable", knownCost: null },
    };
    const [p] = costSeries([legacy]);
    expect(p.cost).toBeNull();
    expect(p.costText).toBeNull();
    expect(hasKnownCost([legacy])).toBe(false);
    expect(hasKnownCost(runs)).toBe(true);
  });
});

describe("token series", () => {
  it("orders priced categories input, output, cache read and leaves unknown counts out", () => {
    expect(tokenCategories(runs)).toEqual(["input", "output", "cache_read"]);
    const [partial, complete] = tokenSeries(runs);
    expect(complete).toMatchObject({ input: 100, output: 20, cache_read: 0 });
    expect(partial.input).toBe(100);
    expect("output" in partial).toBe(false);
  });

  it("sums only known priced tokens per run, null when nothing is known", () => {
    expect(pricedTokens(runs[0])).toBe(120);
    expect(pricedTokens(runs[1])).toBe(100);
    const none: UsageRun = { ...runs[1], billing: { ...runs[1].billing, categories: [] } };
    expect(pricedTokens(none)).toBeNull();
    expect(tokenCategories([none])).toEqual([]);
  });
});

describe("feedback series", () => {
  it("splits accepted, rejected and still-unrated findings per run", () => {
    expect(hasFeedback(runs)).toBe(true);
    const [partial, complete] = feedbackSeries(runs);
    expect(partial).toMatchObject({ accepted: 1, rejected: 0, unrated: 2, total: 3 });
    expect(complete).toMatchObject({ accepted: 0, rejected: 0, unrated: 0, total: 0 });
  });
});

describe("formatTokensAxis", () => {
  it("keeps ticks compact across magnitudes", () => {
    expect([0, 850, 1200, 45_000, 1_300_000].map(formatTokensAxis)).toEqual([
      "0",
      "850",
      "1.2k",
      "45k",
      "1.3M",
    ]);
  });
});
