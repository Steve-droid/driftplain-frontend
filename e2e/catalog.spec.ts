import { test, expect } from "@playwright/test";
import {
  benchmark,
  model,
  observation,
  page as envelope,
} from "../src/catalog/fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mm_token", "expired"));
  await page.route("**/catalog/v1/**", async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/catalog/v1/", "");
    let body: unknown = envelope([]);
    if (endpoint === "benchmarks") body = envelope([benchmark]);
    if (endpoint === "benchmarks/1")
      body = {
        ...benchmark,
        versions: [{ id: 1, version: "Diamond", protocols: [] }],
        taskTypes: [],
      };
    if (endpoint === "models")
      body = envelope([model, { ...model, id: 2, name: "Beta 2" }]);
    if (endpoint === "models/1") body = model;
    if (endpoint === "models/2") body = { ...model, id: 2, name: "Beta 2" };
    if (endpoint === "observations")
      body = envelope([
        {
          ...observation,
          id: Number(url.searchParams.get("modelId") ?? 1),
          modelId: Number(url.searchParams.get("modelId") ?? 1),
          metrics: [
            {
              ...observation.metrics[0],
              value: url.searchParams.get("modelId") === "2" ? "80" : "91.25",
            },
          ],
        },
      ]);
    if (endpoint === "search")
      body = envelope(
        url.searchParams.get("type") === "model"
          ? [{ type: "model", id: 2, name: "Beta 2", subtitle: "Alias match" }]
          : [
              {
                type: "benchmark",
                id: 1,
                name: "GPQA Diamond",
                subtitle: null,
              },
            ],
      );
    await route.fulfill({ json: body });
  });
});
test("anonymous navigation, compare reload/back, and honest chart scopes", async ({
  page,
}) => {
  const privateCalls: string[] = [];
  page.on("request", (r) => {
    if (/\/(projects|jenkins)(\?|$)/.test(r.url())) privateCalls.push(r.url());
  });
  await page.goto("/models");
  await page.getByRole("button", { name: "Add to compare" }).nth(0).click();
  await page.getByRole("button", { name: "Add to compare" }).click();
  await page.getByRole("link", { name: "Compare choices" }).click();
  await expect(
    page.getByRole("heading", { name: "Compare evidence" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("columnheader", { name: "Alpha 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chart this scope" }).click();
  await expect(
    page.getByRole("region", { name: "Comparable measurement chart" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("region", { name: "Comparable measurement chart" }),
  ).toHaveCount(0);
  expect(privateCalls).toEqual([]);
});
test("explanations support focus, Escape, touch, and narrow layouts", async ({
  page,
}, info) => {
  await page.goto("/benchmarks");
  const button = page.getByRole("button", {
    name: "What does GPQA Diamond test?",
  });
  await button.focus();
  await expect(
    page.getByRole("region", { name: "About GPQA Diamond" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "About GPQA Diamond" }),
  ).toHaveCount(0);
  if (info.project.name === "mobile") await button.tap();
  else await button.click();
  await expect(
    page.getByText(benchmark.tooltip!, { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close explanation" }).click();
  await expect(
    page.getByRole("region", { name: "About GPQA Diamond" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("server alias search is keyboard navigable and profile deep links survive reload", async ({
  page,
}) => {
  await page.goto("/benchmarks");
  const input = page.getByRole("combobox", {
    name: "Search models or benchmarks",
  });
  await input.fill("beta-alias");
  await expect(
    page.getByRole("option", { name: "Beta 2 Alias match" }),
  ).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/models\/2/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Beta 2", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Use in CI", exact: true })).toHaveAttribute("href", "/setup?model=2");
});

test("long frozen revisions fit the mobile cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/catalog/v1/benchmarks?*", (route) =>
    route.fulfill({
      json: envelope([
        { ...benchmark, versionLabels: ["Dataset revision " + "a".repeat(64)] },
      ]),
    }),
  );
  await page.goto("/benchmarks");
  await expect(
    page.getByRole("heading", { name: /^GPQA Diamond/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const destination of ["/setup", "/projects"]) {
  test(`sign-in preserves ${destination} intent`, async ({ page }) => {
    const { mockBackend } = await import("./mock-backend");
    await mockBackend(page);
    await page.addInitScript(() => localStorage.clear());
    await page.goto(destination);
    await page.getByLabel("Email").fill("demo@example.com");
    await page
      .getByLabel("Password", { exact: true })
      .fill("modelmatch-demo-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    if (destination === "/setup")
      await expect(
        page.getByRole("heading", { name: "Choose a task. Pick an exact model.", exact: true }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("region", { name: "CI agents dashboard", exact: true }),
      ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(destination));
  });
}
