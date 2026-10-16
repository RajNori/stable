import { defineConfig, devices } from "@playwright/test";

import { readHostedEnv } from "./e2e-hosted/hosted-env";

// Hosted acceptance: real Vercel Preview + approved staging Supabase.
// Run only from the gated `staging-e2e` workflow (or an operator shell).
const env = readHostedEnv();

export default defineConfig({
  testDir: "./e2e-hosted",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI === "true",
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: env.webUrl,
    // No traces: they would capture session cookies and tokens.
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
