import { defineConfig, devices } from "@playwright/test";

const port = 3107;

function webServerEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  env["NODE_ENV"] = "test";
  env["NEXT_PUBLIC_APP_ENV"] = "local";
  env["NEXT_PUBLIC_SUPABASE_URL"] = "http://127.0.0.1:54321";
  env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] = "test-publishable-key";
  return env;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI === "true",
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: `pnpm exec next dev --webpack --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: webServerEnv(),
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
