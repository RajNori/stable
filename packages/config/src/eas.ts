import { ApplicationError, ENV } from "@stable/contracts";
import type { AppEnv } from "@stable/contracts";

import { assertSupabaseUrl } from "./supabase-url.js";

const PROFILE_APP_ENV = {
  development: "local",
  preview: "staging",
  production: "production",
  testflight: "staging",
  "play-internal": "staging",
} as const satisfies Record<string, AppEnv>;

type EasProfileName = keyof typeof PROFILE_APP_ENV;

const APPROVED_STAGING_SUPABASE_URL =
  "https://rporaeagbsfmgbmhyett.supabase.co";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnv(value: unknown, name: EasProfileName): Record<string, string> {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      `EAS ${name} env must be an object.`,
    );
  }

  const env: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        `EAS ${name} env ${key} must be a string.`,
      );
    }
    env[key] = entry;
  }

  return env;
}

function resolveProfile(
  build: Record<string, unknown>,
  name: EasProfileName,
  chain: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const profile = build[name];
  if (!isRecord(profile)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      `eas.json is missing the ${name} build profile.`,
    );
  }
  if (chain.has(name)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      `EAS ${name} profile has a circular extends chain.`,
    );
  }

  const nextChain = new Set(chain).add(name);
  const parentName = profile.extends;
  let parent: Record<string, unknown> = {};
  if (parentName !== undefined) {
    if (typeof parentName !== "string" || !(parentName in build)) {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        `EAS ${name} profile extends an unknown profile.`,
      );
    }
    parent = resolveProfile(build, parentName as EasProfileName, nextChain);
  }

  const parentEnv = isRecord(parent.env) ? parent.env : {};
  const ownEnv = profile.env;
  const env =
    ownEnv === undefined
      ? parentEnv
      : isRecord(ownEnv)
        ? { ...parentEnv, ...ownEnv }
        : ownEnv;
  return { ...parent, ...profile, env };
}

function assertProfile(
  build: Record<string, unknown>,
  name: EasProfileName,
): void {
  const profile = resolveProfile(build, name);
  if ("submit" in profile) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      `EAS ${name} profile must not include a submit section.`,
    );
  }

  const env = readEnv(profile.env, name);
  const expected = PROFILE_APP_ENV[name];
  const appEnv = env[ENV.expoAppEnv];
  if (appEnv === undefined || appEnv.trim().length === 0) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      `EAS ${name} profile is missing ${ENV.expoAppEnv}.`,
    );
  }
  if (appEnv !== expected) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      `EAS ${name} profile must set ${ENV.expoAppEnv}=${expected}.`,
    );
  }

  const url = env[ENV.expoSupabaseUrl];
  if (url !== undefined && url.trim().length > 0) {
    assertSupabaseUrl(url.trim(), expected, "mobile");
  }
  if (name === "preview" && url?.trim() !== APPROVED_STAGING_SUPABASE_URL) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      `EAS preview must set ${ENV.expoSupabaseUrl} to the approved Stable staging project.`,
    );
  }

  if (name === "testflight" || name === "play-internal") {
    if (profile.environment !== "preview") {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        `EAS ${name} must use the preview environment.`,
      );
    }
    if (url?.trim() !== APPROVED_STAGING_SUPABASE_URL) {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        `EAS ${name} must set ${ENV.expoSupabaseUrl} to the approved Stable staging project.`,
      );
    }
    if (name === "play-internal") {
      const android = profile.android;
      if (!isRecord(android) || android.buildType !== "app-bundle") {
        throw new ApplicationError(
          "VALIDATION_FAILED",
          "EAS play-internal must build an Android app bundle.",
        );
      }
    }
  }
}

export function assertEasConfig(input: unknown): void {
  if (!isRecord(input)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      "eas.json must be an object.",
    );
  }
  if ("submit" in input) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      "eas.json must not include a submit hook.",
    );
  }
  if (!isRecord(input.build)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      "eas.json is missing build profiles.",
    );
  }

  assertProfile(input.build, "development");
  assertProfile(input.build, "preview");
  assertProfile(input.build, "production");
  assertProfile(input.build, "testflight");
  assertProfile(input.build, "play-internal");
}
