import { describe, expect, it } from "vitest";

import { readHostedEnv } from "./hosted-env";

const valid = {
  STAGING_WEB_URL: "https://web-git-branch.example.vercel.app/some/path",
  STAGING_SUPABASE_URL: "https://rporaeagbsfmgbmhyett.supabase.co",
  STAGING_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  STAGING_SECRET_KEY: "sb_secret_synthetic",
} as const;

describe("hosted acceptance environment", () => {
  it("accepts the approved staging project and an HTTPS Preview origin", () => {
    const env = readHostedEnv(valid);
    expect(env.webUrl).toBe("https://web-git-branch.example.vercel.app");
    expect(env.vercelBypass).toBeUndefined();
  });

  it("refuses loopback, plain HTTP and the production origin", () => {
    expect(() =>
      readHostedEnv({ ...valid, STAGING_WEB_URL: "https://127.0.0.1:3000" }),
    ).toThrow("not loopback");
    expect(() =>
      readHostedEnv({ ...valid, STAGING_WEB_URL: "http://preview.example" }),
    ).toThrow("HTTPS");
    expect(() =>
      readHostedEnv({
        ...valid,
        PRODUCTION_WEB_URL: "https://web-git-branch.example.vercel.app",
      }),
    ).toThrow("production origin");
  });

  it("refuses any Supabase project other than approved staging", () => {
    expect(() =>
      readHostedEnv({
        ...valid,
        STAGING_SUPABASE_URL: "https://otherprojectref000000.supabase.co",
      }),
    ).toThrow("approved staging project URL");
  });

  it("refuses swapped or missing keys", () => {
    expect(() =>
      readHostedEnv({
        ...valid,
        STAGING_PUBLISHABLE_KEY: "sb_secret_synthetic",
      }),
    ).toThrow("must not be a secret key");
    expect(() => readHostedEnv({ ...valid, STAGING_SECRET_KEY: "" })).toThrow(
      "STAGING_SECRET_KEY is required",
    );
  });
});
