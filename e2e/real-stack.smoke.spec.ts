import { test, expect } from '@playwright/test';

// Local disposable-stack contract: no synthetic activation or paid provider call.
// Exact runnable round-trips are covered by execution.spec.ts and backend API tests.
const API = process.env.E2E_API_BASE_URL ?? 'http://localhost:8000';
const REQUIRE_BACKEND = process.env.E2E_REQUIRE_BACKEND === 'true';
const CREDS = { email: `b17-smoke-${Date.now()}@example.com`, password: 'local-only-test-password' };

test('real backend: public catalog, retired actions and empty runtime eligibility', async ({ page, request }) => {
  let up = false;
  try { up = (await request.get(`${API}/healthz`, { timeout: 2000 })).ok(); } catch { /* optional locally */ }
  if (REQUIRE_BACKEND) expect(up, `backend required at ${API}`).toBe(true);
  else test.skip(!up, `local backend not reachable at ${API}`);

  expect((await request.get(`${API}/catalog/v1/benchmarks`)).ok()).toBe(true);
  expect((await request.post(`${API}/auth/register`, { data: CREDS })).status()).toBe(201);
  const login = await request.post(`${API}/auth/login`, { data: CREDS });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
  for (const path of ['/recommendations', '/recommendations/prefill', '/projects']) {
    expect((await request.post(`${API}${path}`, { headers, data: {} })).status()).toBe(410);
  }
  const candidates = await request.get(`${API}/execution/v1/candidates?task=ci_review&mode=single_call`, { headers });
  expect(candidates.ok()).toBe(true);
  // This test intentionally requires a disposable DB with no activated execution runtimes.
  expect((await candidates.json()).items).toEqual([]);
  await page.goto('/benchmarks');
  await expect(page.getByRole('heading', { name: 'Explore benchmarks', exact: true })).toBeVisible();
  await page.goto('/legacy-setup');
  await page.getByLabel('Email').fill(CREDS.email);
  await page.getByLabel('Password', { exact: true }).fill(CREDS.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Weighted recommendations have been retired.')).toBeVisible();
  await page.getByRole('link', { name: 'Set Up CI', exact: true }).click();
  await page.getByLabel('Task', { exact: true }).selectOption('ci_review');
  await expect(page.getByText(/No eligible/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get recommendation' })).toHaveCount(0);
});
