import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: /execution\.spec\.ts/,
  timeout: 30_000,
  workers: 1,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  use: { baseURL: "http://127.0.0.1:5193" },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 5193 --strictPort",
    url: "http://127.0.0.1:5193",
    reuseExistingServer: false,
  },
});
