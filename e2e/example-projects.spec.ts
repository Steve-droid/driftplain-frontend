import { test, expect } from "@playwright/test";
import { mockBackend } from "./mock-backend";
import { projectsFixture } from "../src/test/fixtures";

for (const width of [1440, 390]) {
  test(`sample projects are clear and browsable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockBackend(page);
    const projects = [
      { ...projectsFixture[0], id: 91, name: "Example: Pull Request Review", isExample: true, setupComplete: false },
      { ...projectsFixture[0], id: 92, name: "Example: Security Scan", taskType: "security_analysis", isExample: true, setupComplete: false },
    ];
    await page.route("**/auth/me", route => route.fulfill({ json: { id: 7, email: "visitor@example.com", chatEnabled: false } }));
    await page.route("**/projects", route => route.fulfill({ json: projects }));
    const dataRequests: string[] = [];
    await page.route(/\/projects\/\d+\/(usage|runs|chat)|\/findings\/\d+\/feedback/, route => {
      dataRequests.push(route.request().url());
      return route.fulfill({ status: 500, json: { detail: "Examples must use local mock data" } });
    });
    await page.addInitScript(() => localStorage.setItem("mm_token", "fixture-token"));
    await page.goto("/");
    await page.getByRole("button", { name: "View my CI agents", exact: true }).click();
    await expect(page.getByRole("heading", { name: projects[0].name })).toBeVisible();
    await expect(page.getByText("Usage and estimated cost", { exact: true })).toBeVisible();
    await expect(page.getByText("Setup incomplete", { exact: true })).toHaveCount(0);
    await expect(page.getByText("30 runs with complete billing categories")).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected-model cost chart" })).toBeVisible();
    await page.getByRole("button", { name: "review-29", exact: true }).click();
    await page.getByRole("button", { name: "View findings", exact: true }).click();
    await expect(page.getByText("Sample: Handle a missing order before accessing its fields.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept finding" })).toHaveCount(0);
    await page.getByRole("button", { name: "7 days", exact: true }).click();
    await expect(page.getByText("7 runs with complete billing categories")).toBeVisible();
    await page.getByRole("button", { name: "All time", exact: true }).click();
    await expect(page.getByText("Ask Driftplain", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "CI-Agent actions" }).click();
    await expect(page.getByRole("menuitem", { name: "CI setup & token" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Delete CI-Agent" })).toBeVisible();
    await page.getByRole("button", { name: "CI-Agent actions" }).click();
    await page.getByRole("combobox", { name: "Select CI-Agent" }).selectOption("92");
    await expect(page.getByRole("heading", { name: projects[1].name })).toBeVisible();
    await expect(page.getByText("20 runs with complete billing categories")).toBeVisible();
    await page.getByRole("button", { name: "scan-19", exact: true }).click();
    await page.getByRole("button", { name: "View findings", exact: true }).click();
    await expect(page.getByText(/Sample: Use a parameterized query/)).toBeVisible();
    expect(dataRequests).toEqual([]);
    await expect(page.getByText(/No CI connection or API key is required/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/p38p-examples-${width}.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Create your own CI agent", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Set up a CI agent", exact: true })).toBeVisible();
  });
}
