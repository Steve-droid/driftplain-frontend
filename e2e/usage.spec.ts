import { test, expect } from "@playwright/test";
import { mockBackend } from "./mock-backend";
import { usageFixture } from "../src/usage/fixtures";
import { projectsFixture } from "../src/test/fixtures";
import type { UsageRun } from "../src/usage/types";

async function open(
  page: import("@playwright/test").Page,
  runs = usageFixture.runs,
) {
  await mockBackend(page);
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: { id: 1, email: "fixture@example.com", chatEnabled: false },
    }),
  );
  await page.route("**/projects", (route) =>
    route.fulfill({ json: [{ ...projectsFixture[0], isExample: true }] }),
  );
  await page.route("**/projects/*/usage/v1?*", (route) =>
    route.fulfill({ json: { ...usageFixture, runs } }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("mm_token", "fixture-token"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /View my CI.agents/i }).click();
  await expect(
    page.getByRole("heading", { name: "Usage and estimated cost" }),
  ).toBeVisible();
}

test("separate estimates, native/normalized unknowns, feedback and illustrative labels", async ({
  page,
}, info) => {
  await open(page);
  await expect(page.getByText("Complete estimates")).toBeVisible();
  await expect(
    page.getByText("Partial known charges", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/1 \/ 3 findings rated/)).toBeVisible();
  await expect(page.getByText(/Illustrative sample CI runs/)).toBeVisible();
  await expect(page.getByText("Cumulative saved")).toHaveCount(0);
  await page
    .getByText("Usage, rates and attribution", { exact: true })
    .nth(1)
    .click();
  await expect(page.getByText("Not reported", { exact: true })).toBeVisible();
  await expect(page.getByText("runner billing incomplete")).toBeVisible();
  await page.route("**/projects/*/runs/*/findings", (route) =>
    route.fulfill({
      json: {
        runId: 2,
        findings: [
          {
            id: 1,
            severity: "low",
            category: "review",
            file: "src/test.py",
            line: 2,
            message: "Illustrative finding",
            cwe: null,
            verdict: null,
          },
        ],
      },
    }),
  );
  await page.route("**/findings/1/feedback", (route) =>
    route.fulfill({ json: { findingId: 1, verdict: "reject" } }),
  );
  await page.getByRole("button", { name: "View findings" }).click();
  await page.getByRole("button", { name: "Reject finding" }).click();
  await expect(
    page.getByRole("button", { name: "Reject finding" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => {})),
    );
  });
  await page.screenshot({
    scale: "css",
    animations: "disabled",
    path: `test-results/b15-usage-${info.project.name}.png`,
    fullPage: true,
  });
});

test("patch, named-test evidence and diagnosis stay distinct from findings", async ({
  page,
}, info) => {
  const base = structuredClone(usageFixture.runs[0]);
  const patch = {
    sha256: "a".repeat(64),
    artifactId: "patch",
    files: [{ path: "tests/test_generated.py", operation: "added" }],
  };
  const testRun: UsageRun = {
    ...base,
    id: 3,
    task: "test_generation",
    mode: "opencode",
    jenkinsBuildId: "generated-tests",
    taskResult: {
      ...base.taskResult!,
      kind: "patch",
      baseCommit: "b".repeat(40),
      patch,
      validations: [
        {
          commandId: "suite",
          status: "passed",
          executionRevisionId: 12,
          baseCommit: "b".repeat(40),
          patchSha256: patch.sha256,
          exitCode: 0,
          generatedTestsDiscovered: 3,
          generatedTestsExecuted: 3,
          testEvidence: {
            profile: "pytest",
            generatedPaths: ["tests/test_generated.py"],
          },
          reason: null,
        },
      ],
      validationStatus: "passed",
      artifacts: [
        {
          id: "patch",
          kind: "patch",
          path: "change.patch",
          sha256: patch.sha256,
          sizeBytes: 500,
        },
      ],
    },
  };
  const diagnosis: UsageRun = {
    ...base,
    id: 4,
    task: "ci_failure_diagnosis",
    jenkinsBuildId: "diagnosis",
    gate: "fail",
    taskResult: {
      ...base.taskResult!,
      failure: {
        stage: "Unit tests",
        buildId: "build-1",
        originalStatus: "FAILURE",
        exitStatus: 1,
        commit: "b".repeat(40),
      },
      report: {
        summary: "Dependency unavailable",
        uncertainty: "Cause needs verification",
        nextSteps: ["Inspect provider status"],
        cause: "external",
        noPatchReason: "External service failure",
        evidenceArtifactIds: [],
      },
    },
  };
  await open(page, [testRun, diagnosis]);
  await expect(
    page.getByText("Generated tests discovered: 3 · executed: 3"),
  ).toBeVisible();
  await expect(page.getByText("Diagnosis summary")).toBeVisible();
  await expect(
    page.getByText(/Diagnosis does not clear this failure/),
  ).toBeVisible();
  await expect(
    page.getByText("No patch: External service failure"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "View findings" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => {})),
    );
  });
  await page.screenshot({
    scale: "css",
    animations: "disabled",
    path: `test-results/b15-results-${info.project.name}.png`,
    fullPage: true,
  });
});

test("owner errors remain visible and never appear as zero spend", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route("**/auth/me", (r) =>
    r.fulfill({ json: { chatEnabled: false } }),
  );
  await page.route("**/projects", (r) => r.fulfill({ json: projectsFixture }));
  await page.route("**/projects/*/usage/v1?*", (r) =>
    r.fulfill({ status: 403, json: { detail: "Access denied" } }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("mm_token", "fixture-token"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /View my CI.agents/i }).click();
  await expect(page.getByText("Access denied")).toBeVisible();
  await expect(page.getByText("Complete estimates")).toHaveCount(0);
});
