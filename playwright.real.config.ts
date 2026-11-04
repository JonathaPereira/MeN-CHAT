import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  testDir: "./tests/real-ui",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "/tmp/menchat-real-ui-results",
  use: { ...base.use, baseURL: "http://127.0.0.1:3106" },
  projects: [
    {
      name: "real-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "real-celular",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "real-pequeno",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 640 },
      },
    },
  ],
  webServer: {
    command: "node scripts/start-real-ui-test.mjs",
    url: "http://127.0.0.1:3106/entrar",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
