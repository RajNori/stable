import { describe, expect, it } from "vitest";

import {
  assertStagingSeedTarget,
  classifySeedRow,
  STAGING_PROJECT_REF,
  STAGING_SUPABASE_URL,
  stagingKeysFromEnv,
} from "./seed-guard.ts";

const approved = {
  appEnv: "staging",
  projectRef: STAGING_PROJECT_REF,
  supabaseUrl: STAGING_SUPABASE_URL,
  args: ["--confirm-staging"],
} as const;

describe("staging seed target guard", () => {
  it("accepts only the confirmed allowlisted staging target", () => {
    expect(() => assertStagingSeedTarget(approved)).not.toThrow();
  });

  it("accepts a dry run only with explicit staging confirmation", () => {
    expect(() =>
      assertStagingSeedTarget({
        ...approved,
        args: ["--confirm-staging", "--dry-run"],
      }),
    ).not.toThrow();
  });

  it("accepts hosted access verification only with explicit staging confirmation", () => {
    expect(() =>
      assertStagingSeedTarget({
        ...approved,
        args: ["--confirm-staging", "--verify-access"],
      }),
    ).not.toThrow();
  });

  it.each([
    ["missing APP_ENV", { ...approved, appEnv: undefined }],
    ["local APP_ENV", { ...approved, appEnv: "local" }],
    ["production APP_ENV", { ...approved, appEnv: "production" }],
    ["missing project ref", { ...approved, projectRef: undefined }],
    ["other project ref", { ...approved, projectRef: "lohriezdxegtkbcbkonw" }],
    [
      "malformed project ref",
      { ...approved, projectRef: "rporaeagbsfmgbmhyet" },
    ],
    ["missing URL", { ...approved, supabaseUrl: undefined }],
    ["loopback URL", { ...approved, supabaseUrl: "http://127.0.0.1:54321" }],
    [
      "URL with alternate port",
      { ...approved, supabaseUrl: `${STAGING_SUPABASE_URL}:54321` },
    ],
    [
      "URL with path",
      { ...approved, supabaseUrl: `${STAGING_SUPABASE_URL}/rest/v1` },
    ],
    ["missing confirmation", { ...approved, args: [] }],
    ["dry run without confirmation", { ...approved, args: ["--dry-run"] }],
    [
      "access verification without confirmation",
      { ...approved, args: ["--verify-access"] },
    ],
    [
      "duplicate confirmation",
      { ...approved, args: ["--confirm-staging", "--confirm-staging"] },
    ],
    [
      "unknown argument",
      { ...approved, args: ["--confirm-staging", "--include-real-data"] },
    ],
  ] as const)("rejects %s", (_description, target) => {
    expect(() => assertStagingSeedTarget(target)).toThrow();
  });
});

describe("staging seed rerun row classification", () => {
  const expected = { id: "synthetic-id", value: 12 };

  it("marks absent rows for initial creation", () => {
    expect(classifySeedRow([], expected, ["id", "value"])).toBe("missing");
  });

  it("skips rows already matching the synthetic baseline", () => {
    expect(classifySeedRow([expected], expected, ["id", "value"])).toBe(
      "matching",
    );
  });

  it("fails closed for a conflicting row or duplicate rows", () => {
    expect(() =>
      classifySeedRow([{ ...expected, value: 99 }], expected, ["id", "value"]),
    ).toThrow(/refusing to overwrite/i);
    expect(() =>
      classifySeedRow([expected, expected], expected, ["id", "value"]),
    ).toThrow(/refusing to overwrite/i);
  });
});

describe("staging seed key source", () => {
  const keys = {
    STAGING_KEY_SOURCE: "env",
    STAGING_SECRET_KEY: "sb_secret_synthetic",
    STAGING_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  } as const;

  it("defaults to the authenticated Supabase CLI when no source is set", () => {
    expect(stagingKeysFromEnv({})).toBeNull();
  });

  it("returns environment keys only when explicitly selected", () => {
    expect(stagingKeysFromEnv(keys)).toEqual({
      serviceKey: "sb_secret_synthetic",
      publicKey: "sb_publishable_synthetic",
    });
  });

  it("rejects any other source value", () => {
    expect(() =>
      stagingKeysFromEnv({ ...keys, STAGING_KEY_SOURCE: "file" }),
    ).toThrow("STAGING_KEY_SOURCE must be exactly env when set.");
  });

  it("requires both keys", () => {
    expect(() =>
      stagingKeysFromEnv({ ...keys, STAGING_SECRET_KEY: "" }),
    ).toThrow("STAGING_SECRET_KEY is required");
    expect(() =>
      stagingKeysFromEnv({ ...keys, STAGING_PUBLISHABLE_KEY: undefined }),
    ).toThrow("STAGING_PUBLISHABLE_KEY is required");
  });

  it("refuses a secret key in the publishable slot or a reused key", () => {
    expect(() =>
      stagingKeysFromEnv({
        ...keys,
        STAGING_PUBLISHABLE_KEY: "sb_secret_synthetic_two",
      }),
    ).toThrow("STAGING_PUBLISHABLE_KEY must not be a secret key.");
    expect(() =>
      stagingKeysFromEnv({
        ...keys,
        STAGING_PUBLISHABLE_KEY: "sb_secret_synthetic",
      }),
    ).toThrow();
    expect(() =>
      stagingKeysFromEnv({
        ...keys,
        STAGING_SECRET_KEY: "sb_publishable_synthetic",
      }),
    ).toThrow("STAGING_SECRET_KEY must differ from the publishable key.");
  });
});
