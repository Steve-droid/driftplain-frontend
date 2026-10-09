import type { Project } from "../types/project";
import type { FindingRow } from "../types/savings";
import type { UsageResponse, UsageRun } from "./types";

// Display-only samples for owner-listed example projects. Never used as a fallback
// for failed API requests, written to the backend, or treated as provider evidence.
const DAY = 86_400_000;
const usd = (micros: number) => (micros / 1_000_000).toFixed(6);

export function exampleFindings(run: UsageRun): FindingRow[] {
  const security = run.task === "security_analysis";
  const examples = security ? [
    ["high", "src/api/search.py", "Use a parameterized query instead of concatenating user input.", "CWE-89: SQL Injection"],
    ["medium", "src/api/profile.py", "Escape profile content before rendering it as HTML.", "CWE-79: Cross-site Scripting"],
    ["low", "src/auth/session.py", "Set an explicit expiry for the session cookie.", null],
  ] : [
    ["medium", "src/api/orders.py", "Handle a missing order before accessing its fields.", null],
    ["low", "src/services/catalog.py", "Fetch the shared configuration once before iterating.", null],
    ["low", "tests/test_orders.py", "Add a test for an empty order list.", null],
  ];
  return examples.slice(0, run.feedback.total).map(([severity, file, message, cwe], i) => ({
    id: -(run.id * 10 + i + 1), severity, category: security ? "security" : "review",
    file, line: 18 + i * 13, message: `Sample: ${message}`, cwe,
    verdict: i < run.feedback.accepted ? "accept" : i < run.feedback.rated ? "reject" : null,
  }));
}

export function exampleUsage(
  project: Pick<Project, "id" | "isExample" | "taskType">, range = "all", offset = 0, now = new Date(),
): UsageResponse {
  if (project.isExample !== true) throw new Error("Mock usage requires an example project");
  const security = project.taskType === "security_analysis";
  const count = security ? 20 : 30;
  // Relative dates keep sample periods useful. UTC noon anchors samples across refreshes.
  const anchor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const runs: UsageRun[] = Array.from({ length: count }, (_, i): UsageRun => {
    const input = (security ? 8200 : 3500) + (i * 719) % 6100;
    const output = (security ? 640 : 280) + (i * 137) % 1100;
    const cache = 1000 + (i * 271) % 2800;
    // Invented, integer-microdollar rates: input $2, output $8, cache $1 / million.
    const categories = [
      { category: "input", tokens: input, ratePerMillion: "2", cost: usd(input * 2) },
      { category: "output", tokens: output, ratePerMillion: "8", cost: usd(output * 8) },
      { category: "cache_read", tokens: cache, ratePerMillion: "1", cost: usd(cache) },
    ];
    const total = i % 4;
    const accepted = Math.max(0, total - 1);
    const rejected = total > 1 && i % 5 === 0 ? 1 : 0;
    return {
      id: i + 1, jenkinsBuildId: `${security ? "scan" : "review"}-${count - i}`,
      createdAt: new Date(anchor - i * DAY).toISOString(),
      model: security ? "Example security model" : "Example review model", provider: "synthetic",
      runtimeId: null, runtimeVersion: "sample-v1", deploymentId: null, executionRevisionId: null,
      task: security ? "security_analysis" : "ci_review", mode: "single_call",
      gate: security && total > 0 || total === 3 ? "fail" : "pass",
      gateReason: total === 3 ? "Sample finding threshold exceeded" : null,
      usageStatus: "complete", legacyCost: null, legacyUsage: null,
      usage: { inputTokens: input, outputTokens: output, cacheReadTokens: cache },
      billing: {
        version: 1, basis: "synthetic_example", status: "complete", currency: "USD",
        knownCost: usd(input * 2 + output * 8 + cache), categories, reasons: [],
        rateSnapshot: {
          rateVersion: "sample-v1", source: "Synthetic sample rates — not provider pricing",
          observedAt: new Date(anchor).toISOString(), pinnedAt: new Date(anchor).toISOString(),
          effectiveAt: new Date(anchor - count * DAY).toISOString(),
          validUntil: new Date(anchor + DAY).toISOString(), serviceTier: "sample",
        },
      },
      feedback: { total, accepted, rejected, rated: accepted + rejected },
      taskResult: {
        kind: "findings", executionStatus: "completed", validationStatus: "not_run",
        baseCommit: null, report: null, patch: null, artifacts: [], validations: [],
      },
    };
  }).filter(run => range === "all" || now.getTime() - Date.parse(run.createdAt!) < Number(range.slice(0, -1)) * DAY);
  const feedback = runs.reduce((sum, run) => ({
    total: sum.total + run.feedback.total, rated: sum.rated + run.feedback.rated,
    accepted: sum.accepted + run.feedback.accepted, rejected: sum.rejected + run.feedback.rejected,
  }), { total: 0, rated: 0, accepted: 0, rejected: 0 });
  return {
    version: 1, projectId: project.id, isExample: true, range, offset, limit: 100,
    total: runs.length, runs: runs.slice(offset, offset + 100), feedback,
    totals: {
      completeCost: runs.length ? usd(runs.reduce((sum, run) => sum + Math.round(Number(run.billing.knownCost) * 1e6), 0)) : null,
      partialCost: null, completeRuns: runs.length, partialRuns: 0,
      unavailableRuns: 0, legacyRuns: 0, reportedRuns: runs.length,
    },
    limitations: ["All runs, models, token counts, rates and findings in this example are fictional.",
      "Sample dates move with the current day so date filters remain useful. Feedback is read-only."],
  };
}
