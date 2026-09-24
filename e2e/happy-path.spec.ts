import {usageFixture} from "../src/usage/fixtures";
import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mock-backend";
import { projectsFixture } from "../src/test/fixtures";

// The S17 happy path: drive the REAL frontend end-to-end against a fully mocked backend
// (route interception). B13 routes the CTA to named setup; this compatibility test
// then opens /legacy-setup → recommend
// (ci_review) → pick → defer-create at the Jenkins step → CI-setup token → dashboard
// (seeded by a mocked CI run) → grounded chat opener → ask one grounded question.
//
// User-facing labels are "CI-Agent" (the data/API stay `project`); the flow is
// defer-create (the project is created at the Jenkins step's Continue, not the pick).

const CREDS = { email: "demo@example.com", password: "modelmatch-demo-2026" };

async function signIn(page: Page) {
  await page.getByLabel("Email").fill(CREDS.email);
  await page.getByLabel("Password", { exact: true }).fill(CREDS.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("login → home → create a CI-Agent → dashboard → grounded chat", async ({ page }) => {
  const mock = await mockBackend(page);
  await page.goto("/");

  // --- login → lands on the home hub (not straight to the dashboard) ---
  await signIn(page);
  const createCta = page.getByRole("button", { name: "Set up a CI agent" }).first();
  await expect(createCta).toBeVisible();

  // --- home → onboarding (drive the real CTA, not a deep link) ---
  await createCta.click();
  await expect(page.getByRole("heading", {name:"Choose a task. Pick an exact model."})).toBeVisible();
  // The legacy consumer remains supported until B17; named journeys are in execution.spec.ts.
  await page.goto("/legacy-setup");
  await expect(page.getByText("Set up your CI agent")).toBeVisible();

  // --- recommender (ci_review, budget-sensitivity High → Nova suggested) ---
  // P38c: the task is a two-option selector naming each task's benchmark. This flow
  // stays on the default (PR code review); the selector itself is unit-tested.
  await expect(page.getByRole("button", { name: /PR code review/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText(/Ranked on CodeReviewBench \(Jun 2026 snapshot\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Security analysis/ })).toBeVisible();

  await page.getByRole("button", { name: "High", exact: true }).click();
  await page.getByRole("button", { name: "Get recommendation" }).click();

  // suggested option is pre-selected; the Nova suggestion + Sonnet baseline render
  await expect(page.getByText("Recommended model")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Nova 2 Lite/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByText("Claude Sonnet 4.5")).toBeVisible();

  // --- pick → Continue (defer-create: no project created yet) ---
  await page.getByLabel("Project name").fill("acme-api");
  await page.getByRole("button", { name: "Continue" }).click();

  // --- E20: review preferences (review task only) → Continue; still no project ---
  await expect(page.getByText("Review preferences", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Review preferences" }).fill("Flag any use of eval().");
  await page.getByRole("button", { name: "Continue" }).click();

  // --- Jenkins step → Continue creates the project, then connects ---
  await expect(page.getByText("Point Driftplain at your Jenkins")).toBeVisible();
  await page.getByLabel("Jenkins base URL").fill("https://jenkins.example.com");
  await page.getByLabel("Job name").fill("acme-api/main");
  await page.getByRole("button", { name: "Continue" }).click();

  // --- CI setup: the mint-once token is shown; go to the dashboard ---
  await expect(page.getByText("mmci_e2e_one_time_token")).toBeVisible();
  await page.getByRole("button", { name: "Go to dashboard" }).click();

  // --- dashboard: the mocked CI run seeds the KPIs / chart / runs table ---
  // (exact: the chat opener's expanded grounding snippet also contains "cumulative saved")
  await expect(page.getByText("Usage and estimated cost", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", {name:"CI run results"})).toBeVisible();
  await expect(page.getByText("report-12 · other")).toBeVisible();
  await expect(page.getByText(/CI gate: pass/)).toBeVisible();

  // --- grounded chat: the server-seeded "explain my spend" opener renders ---
  const chat = page.getByRole("region", { name: "Grounded chat" });
  await expect(chat.getByText(/You've saved \$0\.045/)).toBeVisible();

  // --- ask one grounded question → answer + retrieval trace ---
  await chat.getByLabel("Ask a question").fill("What model am I running?");
  await chat.getByLabel("Ask a question").press("Enter");
  await expect(chat.getByText("What model am I running?")).toBeVisible(); // the user turn
  await expect(chat.getByText(/You're running Nova 2 Lite/)).toBeVisible(); // the answer

  // The source count stays visible; evidence is available on request.
  const trace = chat.getByRole("button", { name: /Grounded on 2 sources/ });
  await expect(trace).toBeVisible();
  await expect(trace).toHaveAttribute("aria-expanded", "false");
  await expect(chat.getByText(/Nova 2 Lite · review_score/)).toBeHidden();
  await trace.click();
  await expect(chat.getByText(/Nova 2 Lite · review_score/)).toBeVisible();
  await trace.click();
  await expect(chat.getByText(/Nova 2 Lite · review_score/)).toBeHidden();

  // fail-closed: no unexpected API call + every critical payload was well-formed
  expect(mock.errors, mock.errors.join("\n")).toHaveLength(0);
});

test("home navigation: View my CI-Agents → dashboard, logo → home, browser Back", async ({
  page,
}) => {
  // Start with one existing agent so the hub offers "View my CI-Agents".
  const mock = await mockBackend(page);
  // Force the GET /projects probe to report an existing agent by pre-creating one.
  await page.route(/^https?:\/\/localhost:8000\/projects$/, async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 7,
            name: "acme-api",
            userId: 1,
            selectedOptionId: 11,
            selectedOptionModel: "Nova 2 Lite",
            baselineModelId: 9,
            baselineModel: "Claude Sonnet 4.5",
            baselineVendor: "Anthropic",
            setupComplete: true,
          },
        ]),
      });
    return route.fallback();
  });

  await page.goto("/");
  await signIn(page);

  // hub → dashboard via "View my CI-Agents"
  await page.getByRole("button", { name: /View my CI agents/ }).first().click();
  await expect(page.getByText("Usage and estimated cost", { exact: true })).toBeVisible();

  // dashboard logo (aria "Home") → back to the hub
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await expect(page.getByRole("button", { name: "Set up a CI agent" }).first()).toBeVisible();

  // browser Back from the hub-after-dashboard returns to the dashboard (history nav)
  await page.goBack();
  await expect(page.getByText("Usage and estimated cost", { exact: true })).toBeVisible();

  expect(mock.errors, mock.errors.join("\n")).toHaveLength(0);
});

// Real browser coverage for the usage drill-in, using only intercepted fixture responses.
for (const width of [1440, 390]) {
  test(`expanded cache usage at ${width}px, including zero and unreported`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const mock = await mockBackend(page);
    await page.route(/^https?:\/\/localhost:8000\/projects$/, (route) =>
      route.fulfill({ json: [projectsFixture[0]] }),
    );
    const runs = [69376, 0, null].map((cacheReadTokens, i) => ({
      ...usageFixture.runs[1],
      id: 114 + i,
      jenkinsBuildId: `cache-${i}`,
      usage: {inputTokens:11501,outputTokens:2618,cacheReadTokens},
    }));
    await page.route(/\/projects\/1\/usage\/v1(?:\?.*)?$/, (route) =>
      route.fulfill({ json: { ...usageFixture, runs } }),
    );
    await page.route(/\/projects\/1\/runs\/\d+\/findings$/, (route) =>
      route.fulfill({ json: { runId: Number(route.request().url().split("/").at(-2)), findings: [] } }),
    );
    await page.goto("/");
    await signIn(page);
    await page.getByRole("button", { name: /View my CI agents/ }).first().click();
    for (const [index, expected] of ["69376", "0", "Not reported"].entries()) {
      const card = page.getByRole("article").filter({has:page.getByRole("heading",{name:new RegExp(`cache-${index}`)})});
      await card.getByText("Usage, rates and attribution",{exact:true}).click();
      await expect(card.locator("dl > div").filter({hasText:"cacheReadTokens"})).toHaveText(`cacheReadTokens${expected}`);
      await expect(card.locator("dl > div").filter({hasText:"inputTokens"})).toHaveText("inputTokens11501");
      await expect(card.locator("dl > div").filter({hasText:"outputTokens"})).toHaveText("outputTokens2618");
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(index===0) await page.screenshot({path:testInfo.outputPath("cache-usage.png"),fullPage:true});
      await card.getByText("Usage, rates and attribution",{exact:true}).click();
      await expect(card.getByText("cacheReadTokens",{exact:true})).toBeHidden();
    }
    expect(mock.errors, mock.errors.join("\n")).toHaveLength(0);
  });
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`single-screen home and navigation focus (${reducedMotion})`, async ({ page }) => {
    const mock = await mockBackend(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    await signIn(page);
    await expect(page.getByRole("button", { name: "Set up a CI agent", exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "View my CI agents", exact: true })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
    await expect(page.getByText("Explore your workspace")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThan(2);
    await page.getByRole("button", { name: "Set up a CI agent", exact: true }).click();
    await expect(page.getByRole("region", { name: "Set up a CI agent", exact: true })).toBeFocused();
    await expect(page.getByLabel("Task", {exact:true})).toHaveValue("");
    await expect(page.getByRole("group", {name:"Budget sensitivity"})).toHaveCount(0);
    // Retain the legacy control and focus regression separately.
    await page.goto("/legacy-setup");
    const budget = page.getByRole("group", { name: "Budget sensitivity", exact: true });
    const speed = page.getByRole("group", { name: "CI-Agent speed", exact: true });
    await expect(budget.getByRole("button", { name: "High", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(speed.getByRole("button", { name: "Any", exact: true })).toHaveAttribute("aria-pressed", "true");
    await budget.getByRole("button", { name: "Low", exact: true }).click();
    await expect(budget.getByRole("button", { name: "Low", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(budget.getByRole("button", { name: "High", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Back to home", exact: true }).click();
    await expect(page.getByRole("region", { name: "Home", exact: true })).toBeFocused();
    // Smaller screens scroll the single page normally, with no section snapping.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText("Savings count only when the quality signal holds.").scrollIntoViewIfNeeded();
    await expect(page.getByText("Savings count only when the quality signal holds.")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(mock.errors, mock.errors.join("\n")).toHaveLength(0);
  });
}

test("auth backdrop keeps a clear zone around the message at desktop and tablet widths", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const separation = await page.evaluate(() => {
      const message = document.querySelector(".auth-message")!;
      const first = message.firstElementChild!.getBoundingClientRect();
      const last = message.lastElementChild!.getBoundingClientRect();
      return {
        top: first.top - document.querySelector(".auth-ambient-above")!.getBoundingClientRect().bottom,
        bottom: document.querySelector(".auth-ambient-below")!.getBoundingClientRect().top - last.bottom,
      };
    });
    expect(separation.top).toBeGreaterThanOrEqual(64);
    expect(separation.bottom).toBeGreaterThanOrEqual(64);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".auth-ambient-above")).toBeHidden();
  await expect(page.locator(".auth-ambient-below")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
