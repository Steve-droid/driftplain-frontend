import { describe, expect, it } from "vitest";
import { exampleUsage, exampleFindings } from "./examples";
import { projectsFixture } from "../test/fixtures";

const project = { ...projectsFixture[0], isExample: true };
const now = new Date("2026-09-24T12:00:00Z");
describe("example project usage", () => {
  it("never supplies mock data for real projects", () => {
    expect(() => exampleUsage({ ...project, isExample: false }, "all", 0, now)).toThrow();
  });
  it("has consistent complete mock costs, counters and findings", () => {
    const data = exampleUsage(project, "all", 0, now);
    expect(data.runs).toHaveLength(30);
    expect(data.totals.partialRuns).toBe(0);
    expect(data.totals.completeRuns).toBe(30);
    const total = data.runs.reduce((sum, run) => sum + Math.round(Number(run.billing.knownCost) * 1e6), 0);
    expect(data.totals.completeCost).toBe((total / 1e6).toFixed(6));
    for (const run of data.runs) {
      expect(run.billing.categories.reduce((sum,c) => sum + Math.round(Number(c.cost)*1e6),0)).toBe(Math.round(Number(run.billing.knownCost)*1e6));
      expect(exampleFindings(run)).toHaveLength(run.feedback.total);
      expect(exampleFindings(run).filter(f => f.verdict != null)).toHaveLength(run.feedback.rated);
    }
  });
  it.each(["ci_review", "security_analysis"])("shows identical %s data for different accounts", taskType => {
    const first = exampleUsage({ ...project, id: 91, taskType }, "all", 0, now);
    const second = exampleUsage({ ...project, id: 207, taskType }, "all", 0, now);
    expect(first.projectId).toBe(91);
    expect(second.projectId).toBe(207);
    expect({ ...first, projectId: null }).toEqual({ ...second, projectId: null });
    expect(first.runs.map(exampleFindings)).toEqual(second.runs.map(exampleFindings));
  });
  it("filters periods before paging and uses the project's task", () => {
    const security = { ...project, id:92, taskType:"security_analysis" };
    const week = exampleUsage(security, "7d", 0, now);
    expect(week.total).toBe(7);
    expect(week.runs.every(r => r.task === "security_analysis")).toBe(true);
    const later = exampleUsage(security, "all", 100, now);
    expect(later.runs).toEqual([]);
    expect(later.total).toBe(20);
    expect(later.totals.completeRuns).toBe(20);
  });
});
