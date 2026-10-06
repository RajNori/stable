import { defineConfig, devices } from "@playwright/test";

const port = 3000;

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(
      `${name} is required for the local auth Playwright project.`,
    );
  }
  if (value.startsWith("sb_secret_")) {
    throw new Error(`${name} must not be a secret key.`);
  }
  return value;
}

function webServerEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  env["NODE_ENV"] = "development";
  env["NEXT_PUBLIC_APP_ENV"] = "local";
  env["NEXT_PUBLIC_SUPABASE_URL"] = required("SUPABASE_URL");
  env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] = required(
    "SUPABASE_PUBLISHABLE_KEY",
  );
  delete env["SUPABASE_SECRET_KEY"];
  delete env["SECRET_KEY"];
  delete env["SERVICE_ROLE_KEY"];
  return env;
}

export default defineConfig({
  testDir: "./e2e-auth",
  fullyParallel: false,
  workers: 1,
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
