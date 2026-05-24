import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load local env (DATABASE_URL, AUTH_SECRET, …). The dev server is started by
// Playwright's webServer below with E2E_TEST_MODE=1 so the credentials provider
// is active.
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DEMO = process.env.DEMO === "1";

export default defineConfig({
  testDir: "./e2e",
  // Demo mode runs serially & slowed-down so you can watch every click.
  fullyParallel: !DEMO,
  workers: DEMO ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    launchOptions: { slowMo: DEMO ? 600 : 0 },
  },

  projects: [
    // 1) Provision E2E users + permissions in the DB.
    { name: "setup:db", testMatch: /setup\/seed\.setup\.ts/ },

    // 2) Authenticate and save storage states (needs the users to exist).
    {
      name: "setup:auth",
      testMatch: /setup\/auth\.setup\.ts/,
      dependencies: ["setup:db"],
    },

    // 3) Desktop browser — full keyboard/sidebar UX.
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup:auth"],
    },

    // 4) Mobile — iPhone 13 (newer than XS), real touch + mobile layout.
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup:auth"],
    },
  ],

  // One command starts the app with E2E auth enabled and runs the suite.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      E2E_TEST_MODE: "1",
      NODE_ENV: "development",
    },
  },
});
