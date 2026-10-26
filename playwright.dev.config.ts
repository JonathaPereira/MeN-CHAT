import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  testDir: "./tests/dev",
  fullyParallel: true,
  timeout: 30_000,
  reporter: "list",
  use: { ...base.use, baseURL: "http://127.0.0.1:3102" },
  projects: [
    { name: "dev-desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "dev-celular",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 0.0.0.0 --port 3102",
    url: "http://127.0.0.1:3102/login",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
