import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  assertLocalDevelopmentSupabaseUrl,
  resolveLocalBootstrapDestination,
} from "./index.js";

const STATUS_URL = "http://127.0.0.1:54321";

describe("local auth bootstrap URL", () => {
  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
  ])("accepts loopback %s", (url) => {
    expect(() => assertLocalDevelopmentSupabaseUrl(url)).not.toThrow();
  });

  it.each([
    "http://10.0.2.2:54321",
    "http://192.168.1.20:54321",
    "http://172.16.0.4:54321",
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

describe("local bootstrap destination", () => {
  it("accepts the local Supabase endpoint reported by status", () => {
    expect(
      resolveLocalBootstrapDestination({
        requestedUrl: "http://127.0.0.1:54321/",
        statusUrl: STATUS_URL,
      }),
    ).toBe(STATUS_URL);
    expect(
      resolveLocalBootstrapDestination({
        statusUrl: `${STATUS_URL}/`,
      }),
    ).toBe(STATUS_URL);
  });

  it("rejects a conflicting RFC1918 host", () => {
    expect(() =>
      resolveLocalBootstrapDestination({
        requestedUrl: "http://192.168.1.20:54321",
        statusUrl: STATUS_URL,
      }),
    ).toThrow(/loopback Supabase endpoint/);
  });

  it("rejects a conflicting loopback port before it can be requested", () => {
    expect(() =>
      resolveLocalBootstrapDestination({
        requestedUrl: "http://127.0.0.1:59999",
        statusUrl: STATUS_URL,
      }),
    ).toThrow(/does not match the local Supabase endpoint/);
  });

  it.each(["https://abcd.supabase.co", "https://example.com", "not a url"])(
    "rejects %s before a privileged request",
    (requestedUrl) => {
      expect(() =>
        resolveLocalBootstrapDestination({
          requestedUrl,
          statusUrl: STATUS_URL,
        }),
      ).toThrow(/local-development tooling/);
    },
  );

  it("rejects a path, query, or hash on the local endpoint", () => {
    expect(() =>
      resolveLocalBootstrapDestination({
        statusUrl: "http://127.0.0.1:54321/auth/v1",
      }),
    ).toThrow(/API origin/);
    expect(() =>
      resolveLocalBootstrapDestination({
        statusUrl: "http://127.0.0.1:54321?x=1",
      }),
    ).toThrow(/query or hash/);
    expect(() =>
      resolveLocalBootstrapDestination({
        statusUrl: "http://127.0.0.1:54321#frag",
      }),
    ).toThrow(/query or hash/);
  });

  it("uses the status endpoint when the override is blank", () => {
    expect(
      resolveLocalBootstrapDestination({
        requestedUrl: "   ",
        statusUrl: STATUS_URL,
      }),
    ).toBe(STATUS_URL);
  });

  it("rejects a status endpoint that is not loopback", () => {
    expect(() =>
      resolveLocalBootstrapDestination({
        statusUrl: "http://192.168.1.20:54321",
      }),
    ).toThrow(/loopback Supabase endpoint/);
  });
});

describe("bootstrap script", () => {
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

  function runBootstrap(url: string): {
    status: number | null;
    stdout: string;
    stderr: string;
  } {
    return spawnSync(
      "node",
      [
        "--experimental-strip-types",
        "--import",
        "./scripts/register-workspace-ts.mjs",
        "scripts/bootstrap-local-auth.ts",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          SUPABASE_URL: url,
          SUPABASE_SECRET_KEY: "sb_secret_not_used",
        },
      },
    );
  }

  it("rejects a hosted project before any privileged request", () => {
    const result = runBootstrap("https://abcd.supabase.co");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/local-development tooling/);
    expect(result.stderr).toMatch(/supabase\.co/);
    expect(result.stderr).not.toContain("sb_secret_not_used");
    expect(result.stdout).not.toContain("bootstrapped");
  });

  it("rejects an RFC1918 override before any privileged request", () => {
    const result = runBootstrap("http://192.168.1.20:54321");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/loopback Supabase endpoint/);
    expect(result.stderr).not.toContain("sb_secret_not_used");
    expect(result.stdout).not.toContain("bootstrapped");
  });

  it("rejects a public host and a malformed URL before any privileged request", () => {
    const publicHost = runBootstrap("https://example.com");
    const malformed = runBootstrap("not a url");

    expect(publicHost.status).not.toBe(0);
    expect(publicHost.stderr).toMatch(/private LAN or public host/);
    expect(malformed.status).not.toBe(0);
    expect(malformed.stderr).toMatch(/not a valid absolute URL/);
    expect(publicHost.stdout + malformed.stdout).not.toContain("bootstrapped");
  });
});
