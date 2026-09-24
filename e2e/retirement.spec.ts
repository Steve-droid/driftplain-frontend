import { test, expect } from '@playwright/test';
import { mockBackend } from './mock-backend';
import { projectsFixture } from '../src/test/fixtures';

for (const width of [1440, 390]) {
  test(`product claims and retired entry points at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await mockBackend(page);
    await page.route('http://localhost:8000/projects', route => route.fulfill({ json: projectsFixture }));
    const legacyCalls: string[] = [];
    page.on('request', r => {
      if (r.method() === 'POST' && /\/(recommendations|projects)(\/prefill)?$/.test(r.url())) legacyCalls.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByText(/savings backed by quality|Less spend/i)).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem('mm_token', 'fixture-token'));
    await page.reload();
    await expect(page.getByRole('heading', { name: /Compare benchmark results/i })).toBeVisible();
    await expect(page.getByText(/lowest cost|quality comes first|savings count only/i)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
    });
    await page.screenshot({ animations: 'disabled', path: `/tmp/b17-home-${width}.png`, fullPage: true });
    await page.goto('/legacy-setup');
    await expect(page.getByRole('button', { name: 'Get recommendation' })).toHaveCount(0);
    await expect(page.getByText('Weighted recommendations have been retired.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Set Up CI', exact: true }).last().click();
    await expect(page).toHaveURL(/\/setup$/);
    await page.goto('/projects');
    await page.getByRole('button', { name: 'CI-Agent actions' }).click();
    await page.getByRole('menuitem', { name: 'Re-pick model' }).click();
    await expect(page).toHaveURL(/\/setup\?project=1$/);
    expect(legacyCalls).toEqual([]);
  });
}
