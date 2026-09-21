import { test, expect } from "@playwright/test";
import { mockBackend } from "./mock-backend";
import { projectsFixture } from "../src/test/fixtures";

for (const width of [1440, 390]) {
  test(`ordinary dashboard hides chat at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await mockBackend(page);
    let chatRequests = 0;
    page.on("request", (r) => { if (/\/projects\/\d+\/chat/.test(r.url())) chatRequests++; });
    await page.route("**/auth/me", (route) => route.fulfill({ json: { id: 2, email: "visitor@example.com", chatEnabled: false } }));
    await page.route("**/projects", (route) => route.fulfill({ json: projectsFixture }));
    await page.addInitScript(() => localStorage.setItem("mm_token", "fixture-token"));
    await page.goto("/");
    await page.getByRole("button", { name: /View my CI.agents/i }).click();
    await expect(page.getByText("Cumulative saved")).toBeVisible();
    await expect(page.locator("textarea")).toHaveCount(0);
    expect(chatRequests).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Let the app's view transition finish before measuring/capturing final layout.
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
    });
    await page.screenshot({ animations: "disabled", path: `test-results/p38o-visitor-${width}.png`, fullPage: true });
  });
}

test("no temporary-demo notice on sign-in or sign-up (maintained service since September 2026)", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  await expect(page.getByText(/temporary portfolio demo/)).toHaveCount(0);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText(/temporary portfolio demo/)).toHaveCount(0);
});
