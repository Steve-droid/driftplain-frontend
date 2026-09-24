import { test, expect, type Page } from "@playwright/test";
import {
  model,
  observation,
  benchmark,
  page as envelope,
} from "../src/catalog/fixtures";
import type { Candidate, Profile, ProjectInput } from "../src/execution/api";
const row: Candidate = {
  runtimeId: 1,
  catalogModelId: 1,
  model: "Alpha 1",
  provider: "Provider A",
  providerModelId: "alpha-exact",
  deploymentId: 9,
  observationId: 1,
  snapshotId: 1,
  method: "supported_unranked",
  group: "g1",
  score: "91.25000001",
  reportedValue: "91.25000001%",
  sourceRank: null,
  sourceGroupRank: 1,
  benchmarkRunner: "Fixture runner",
  executionMode: "single_call",
  runtimeVersion: "fixture-v1",
  rank: null,
  position: null,
};
async function fixtures(page: Page, signedIn = true) {
  if (signedIn)
    await page.addInitScript(() => localStorage.setItem("mm_token", "fixture"));
  const state: {
    saved: ProjectInput[];
    disabled: boolean;
    connectionFails: boolean;
  } = { saved: [], disabled: false, connectionFails: false };
  await page.route("**/catalog/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split("/catalog/v1/")[1];
    expect(route.request().headers().authorization).toBeUndefined();
    let body: unknown = envelope([]);
    if (path === "models")
      body = envelope([
        model,
        { ...model, id: 99, name: "Alpha related variant" },
      ]);
    if (path.startsWith("models/"))
      body = { ...model, id: Number(path.split("/")[1]) };
    if (path === "observations") body = envelope([observation]);
    if (path.startsWith("observations/")) body = observation;
    if (path === "benchmarks") body = envelope([benchmark]);
    if (path.startsWith("benchmarks/"))
      body = { ...benchmark, versions: [], taskTypes: [] };
    await route.fulfill({ json: body });
  });
  await page.route("**/auth/**", async (route) => {
    await route.fulfill({
      json: route.request().url().endsWith("/login")
        ? { accessToken: "fixture", tokenType: "bearer" }
        : { enabled: false },
    });
  });
  await page.route("**/projects**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/execution/")) return route.fallback();
    if (path.endsWith("/jenkins")) {
      if (state.connectionFails) {
        state.connectionFails = false;
        return route.fulfill({
          status: 503,
          json: { detail: "Jenkins metadata temporarily unavailable" },
        });
      }
      return route.fulfill({
        json: { baseUrl: "https://ci.example.org", jobName: "review" },
      });
    }
    return route.fulfill({ json: [] });
  });
  const project = (input: ProjectInput) => ({
    id: 7,
    name: input.name,
    executionRevisionId: 33,
    observationId: input.selection.observationId,
    snapshotId: 1,
    selectionMethod: input.selection.method,
    policyResult: { group: input.selection.group },
    configuration: {
      taskType: input.selection.task,
      executionMode: input.selection.mode,
      runtimeId: input.selection.runtimeId,
      catalogModelId: 1,
      deploymentId: 9,
      model: {
        name: "Alpha 1",
        provider: "fixture",
        providerModelId: "alpha-exact",
        credentialEnvVar: "OPENAI_API_KEY",
      },
      policy: {
        ...input.selection,
        version: "fixture",
        benchmark: null,
        benchmarkVersion: null,
        metric: null,
        direction: null,
      },
      taskConfiguration: input.taskConfiguration,
      reviewPreferences: input.reviewPreferences,
    },
  });
  await page.route("**/execution/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/candidates")) {
      const p = url.searchParams;
      const profile: Profile = {
        task: p.get("task") as Profile["task"],
        mode: p.get("mode") as Profile["mode"],
        language: p.get("language") as Profile["language"],
        proposeFix: p.get("proposeFix") === "true",
      };
      const ranked = p.get("group") === "g1";
      const items =
        state.disabled || p.get("catalogModelId") === "99"
          ? []
          : [
              {
                ...row,
                executionMode: profile.mode,
                method: ranked ? "benchmark_ranked" : "supported_unranked",
                rank: ranked ? 1 : null,
                position: ranked ? 1 : null,
              },
            ];
      return route.fulfill({
        json: {
          policy: {
            ...profile,
            version: "fixture",
            benchmark: "codereviewbench",
            benchmarkVersion: "Fixture protocol 2026-09-24",
            metric: "f1",
            direction: "higher",
          },
          groups: [{ id: "g1", supportedResults: 1, totalResults: 3 }],
          items,
          total: items.length,
          offset: 0,
        },
      });
    }
    if (url.pathname.endsWith("/ci-command"))
      return route.fulfill({
        json: {
          executionRevisionId: 33,
          executionMode: "single_call",
          command: "docker run fixture@sha256:aaa",
          jenkinsStage: "stage('Review changes') { /* fixture */ }",
          launcherImage: "fixture@sha256:aaa",
          editorImage: null,
        },
      });
    if (url.pathname.endsWith("/ci-token"))
      return route.fulfill({ json: { token: "fixture-once-token" } });
    if (
      route.request().method() === "POST" ||
      route.request().method() === "PATCH"
    ) {
      const input = route.request().postDataJSON() as ProjectInput;
      state.saved.push(input);
      return route.fulfill({ json: project(input) });
    }
    return route.fulfill({
      json: project(
        state.saved.at(-1) ?? {
          name: "Existing",
          selection: {
            task: "ci_review",
            mode: "single_call",
            language: null,
            proposeFix: false,
            runtimeId: 1,
            observationId: 1,
            method: "supported_unranked",
            group: null,
          },
          taskConfiguration: {
            inputs: { diff: true, files: [], artifacts: [] },
          },
          reviewPreferences: "Be concise",
        },
      ),
    });
  });
  return state;
}
async function pick(page: Page, task: Profile["task"]) {
  await page.getByLabel("Task", { exact: true }).selectOption(task);
  await page.getByLabel("Search these models").fill("Alpha");
  await page.getByRole("button", { name: /Choose Alpha 1/ }).click();
  await page.getByLabel("Project name").fill("Named setup");
  await expect(
    page.getByRole("button", { name: "Continue to Jenkins" }),
  ).toBeEnabled();
}
for (const task of [
  "ci_review",
  "security_analysis",
  "test_generation",
  "ci_failure_diagnosis",
] as const) {
  test(`direct search through versioned setup: ${task}`, async ({ page }) => {
    const state = await fixtures(page);
    await page.goto("/setup");
    await pick(page, task);
    if (task === "test_generation") {
      await page.getByLabel("Dependency lock SHA-256").fill("a".repeat(64));
      await page
        .getByLabel("Reviewed validation image")
        .fill("example/tests@sha256:" + "b".repeat(64));
    }
    if (task === "ci_failure_diagnosis")
      await page.getByLabel("Failed upstream stage").fill("Unit tests");
    await page.getByRole("button", { name: "Continue to Jenkins" }).click();
    await page.getByLabel("Jenkins base URL").fill("https://ci.example.org");
    await page.getByLabel("Job name").fill("named");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Versioned CI setup" }),
    ).toBeVisible();
    expect(state.saved).toHaveLength(1);
    expect(state.saved[0].selection.task).toBe(task);
    expect(state.saved[0].selection.runtimeId).toBe(1);
    expect(state.saved[0].selection.method).toBe("supported_unranked");
    await page.getByRole("button", { name: "Get CI token" }).click();
    await expect(page.getByLabel("CI token")).toContainText(
      "fixture-once-token",
    );
    const stored = await page.evaluate(() => JSON.stringify(sessionStorage));
    expect(stored).not.toContain("fixture-once-token");
  });
}
test("anonymous exact evidence return, benchmark explanation, draft and back navigation", async ({
  page,
}, testInfo) => {
  await fixtures(page, false);
  await page.goto("/models/1");
  await page.getByRole("link", { name: "Use this evidence in CI" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.org");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/model=1&evidence=1/);
  await pick(page, "ci_review");
  await page
    .getByRole("button", { name: "What does GPQA Diamond test?" })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "About GPQA Diamond" }).first(),
  ).toContainText("not code-review ability");
  await page.getByLabel("Recommendation group").selectOption("g1");
  await expect(
    page.getByRole("region", { name: "Benchmark recommendations" }),
  ).toContainText("91.25000001");
  await page.getByRole("link", { name: "Inspect the full Explorer" }).click();
  await page.getByRole("link", { name: "Return to CI setup" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Named setup");
  await expect(page.getByLabel("Task", { exact: true })).toHaveValue(
    "ci_review",
  );
  await page.goBack();
  await expect(page).toHaveURL(/benchmarks/);
  await page.goForward();
  await expect(page.getByLabel("Project name")).toHaveValue("Named setup");
  await expect(
    page.getByRole("button", { name: "Continue to Jenkins" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/b13-setup-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});
test("profile changes, disabled selection, exact variant, editing and partial save retry", async ({
  page,
}) => {
  const state = await fixtures(page);
  await page.goto("/setup?project=7");
  await expect(page.getByLabel("Project name")).toHaveValue("Existing");
  await pick(page, "test_generation");
  await page.getByLabel("Test language").selectOption("node");
  await expect(
    page.getByRole("button", { name: "Continue to Jenkins" }),
  ).toBeDisabled();
  await expect(page.getByText(/Previous pick:/)).toBeVisible();
  await pick(page, "ci_failure_diagnosis");
  await page.getByLabel("Propose a fix").check();
  await expect(
    page.getByRole("button", { name: "Continue to Jenkins" }),
  ).toBeDisabled();
  await pick(page, "ci_review");
  state.disabled = true;
  await page.getByRole("button", { name: "Continue to Jenkins" }).click();
  await expect(page.getByRole("alert")).toContainText("no longer eligible");
  state.disabled = false;
  await page.getByRole("button", { name: /Choose Alpha 1/ }).click();
  await expect(
    page.getByRole("button", { name: "Continue to Jenkins" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Continue to Jenkins" }).click();
  state.connectionFails = true;
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Jenkins metadata temporarily unavailable"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Versioned CI setup" }),
  ).toBeVisible();
  expect(
    state.saved.every((s) =>
      Object.keys(s.selection).every((k) =>
        [
          "task",
          "mode",
          "language",
          "proposeFix",
          "runtimeId",
          "observationId",
          "method",
          "group",
        ].includes(k),
      ),
    ),
  ).toBe(true);
  await page.goto("/setup?model=99");
  await page.getByLabel("Task", { exact: true }).selectOption("ci_review");
  await expect(
    page.getByText(/Requested exact model has no eligible choice/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose Alpha/ })).toHaveCount(
    0,
  );
});

test("same-profile re-pick preserves existing configuration and preferences", async ({
  page,
}) => {
  const state = await fixtures(page);
  const original: ProjectInput = {
    name: "Configured review",
    selection: {
      task: "ci_review",
      mode: "single_call",
      language: null,
      proposeFix: false,
      runtimeId: 1,
      observationId: 1,
      method: "supported_unranked",
      group: null,
    },
    taskConfiguration: {
      inputs: { diff: true, files: [], artifacts: [], maxBytes: 10000 },
      resources: { maxTokens: 12345, maxSeconds: 90 },
      instructions: "Keep this literal instruction",
    },
    reviewPreferences: "Keep this preference",
  };
  state.saved.push(original);
  await page.goto("/setup?project=7");
  await expect(page.getByLabel("Project name")).toHaveValue(original.name);
  await page.getByRole("button", { name: /Choose Alpha 1/ }).click();
  await page.getByRole("button", { name: "Continue to Jenkins" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Versioned CI setup" }),
  ).toBeVisible();
  expect(state.saved.at(-1)?.taskConfiguration).toEqual(
    original.taskConfiguration,
  );
  expect(state.saved.at(-1)?.reviewPreferences).toBe(
    original.reviewPreferences,
  );
});
