import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /(happy-path|public-access|example-projects|retirement)\.spec\.ts/,
  timeout: 30_000,
  workers: 1,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5191" },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 5191 --strictPort",
    url: "http://127.0.0.1:5191",
    reuseExistingServer: false,
  },
});
