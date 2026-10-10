import { describe, expect, it } from "vitest";

import {
  assertStagingSeedTarget,
  STAGING_PROJECT_REF,
  STAGING_SUPABASE_URL,
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
