import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { assertLocalDevelopmentSupabaseUrl } from "./index.js";

describe("local auth bootstrap URL", () => {
  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
    "http://10.0.2.2:54321",
    "http://192.168.1.20:54321",
  ])("accepts %s", (url) => {
    expect(() => assertLocalDevelopmentSupabaseUrl(url)).not.toThrow();
  });

  it.each([
    "https://abcd.supabase.co",
    "https://project.supabase.co/rest/v1",
    "http://8.8.8.8:54321",
    "https://example.com",
    "not a url",
    "ftp://127.0.0.1/db",
  ])("rejects %s", (url) => {
    expect(() => assertLocalDevelopmentSupabaseUrl(url)).toThrow(
      /local-development tooling/,
    );
  });
});

describe("bootstrap script", () => {
  it("exits before contacting a hosted Supabase project", () => {
    const result = spawnSync(
      "node",
      [
        "--experimental-strip-types",
        "--import",
        "./scripts/register-workspace-ts.mjs",
        "scripts/bootstrap-local-auth.ts",
      ],
      {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        encoding: "utf8",
        env: {
          ...process.env,
          SUPABASE_URL: "https://abcd.supabase.co",
          SUPABASE_SECRET_KEY: "sb_secret_not_used",
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/local-development tooling/);
    expect(result.stderr).toMatch(/supabase\.co/);
    expect(result.stderr).not.toContain("sb_secret_not_used");
    expect(result.stdout).not.toContain("bootstrapped");
  });
});
