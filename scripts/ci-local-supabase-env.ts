/**
 * Exports the local Supabase API origin for a CI job.
 *
 * Reads `supabase status -o env`, accepts only a loopback origin, and writes
 * the URL plus publishable key to GITHUB_ENV. Secret keys are never exported
 * or printed.
 *
 * Run from the repo root after `supabase start`:
 *   node --experimental-strip-types --import ./scripts/register-workspace-ts.mjs scripts/ci-local-supabase-env.ts
 */

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

import { assertLocalDevelopmentSupabaseUrl } from "../packages/config/src/supabase-url.ts";

const ENV_DELIMITER = "__STABLE_CI_LOCAL_SUPABASE__";

function parseEnv(text: string): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator);
    let value = trimmed.slice(separator + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.set(key, value);
  }
  return entries;
}

function readStatusEnv(): ReadonlyMap<string, string> {
  try {
    const stdout = execFileSync(
      "node_modules/.bin/supabase",
      ["status", "-o", "env"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return parseEnv(stdout);
  } catch {
    throw new Error(
      "supabase status failed. Start the local stack before reading its URL.",
    );
  }
}

function required(
  entries: ReadonlyMap<string, string>,
  names: string[],
): string {
  for (const name of names) {
    const value = entries.get(name);
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  throw new Error(`supabase status did not report ${names.join(" or ")}.`);
}

function assertPublishableKey(key: string): void {
  if (key.startsWith("sb_secret_") || key.startsWith("eyJ")) {
    throw new Error("Refusing to export a Supabase secret key.");
  }
}

function writeGithubEnv(name: string, value: string, githubEnv: string): void {
  if (value.includes(ENV_DELIMITER)) {
    throw new Error(`Refusing to export ${name}.`);
  }
  appendFileSync(
    githubEnv,
    `${name}<<${ENV_DELIMITER}\n${value}\n${ENV_DELIMITER}\n`,
  );
}

const status = readStatusEnv();
const url = required(status, ["API_URL", "SUPABASE_URL"]);
assertLocalDevelopmentSupabaseUrl(url);
const publishableKey = required(status, [
  "PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
]);
assertPublishableKey(publishableKey);

const githubEnv = process.env.GITHUB_ENV;
if (githubEnv !== undefined && githubEnv.length > 0) {
  writeGithubEnv("SUPABASE_URL", url, githubEnv);
  writeGithubEnv("SUPABASE_PUBLISHABLE_KEY", publishableKey, githubEnv);
}

const host = new URL(url).host;
console.log(`local supabase host ${host}`);
