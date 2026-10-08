/**
 * Creates local login users after `supabase db reset`.
 *
 * The destination is the loopback API URL from `supabase status`.
 * SUPABASE_URL may repeat that origin. Any other host, including a private
 * LAN address, is rejected before an Admin API or PostgREST call. There is
 * no alternate-host setting. A legacy service-role variable is accepted from
 * `supabase status -o env` only and is never written to app env files.
 *
 * Run from the repo root:
 *   node --experimental-strip-types --import ./scripts/register-workspace-ts.mjs scripts/bootstrap-local-auth.ts
 *   node --experimental-strip-types --import ./scripts/register-workspace-ts.mjs scripts/bootstrap-local-auth.ts --verify-member
 */

import { execFileSync } from "node:child_process";

import {
  assertLocalDevelopmentSupabaseUrl,
  resolveLocalBootstrapDestination,
} from "../packages/config/src/supabase-url.ts";

const CLUB_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const OUTSIDER_ID = "33333333-3333-4333-8333-333333333333";
const GUARDIAN_ID = "55555555-5555-4555-8555-555555555555";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const MEMBER_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";
const GUARDIAN_EMAIL = "guardian@local.stable.test";
const LOCAL_PASSWORD = "local-dev-password";

type JsonRecord = Record<string, unknown>;

function redact(text: string): string {
  return text
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted]",
    );
}

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

function firstDefined(values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return undefined;
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "status failed";
    throw new Error(`supabase status failed: ${redact(message)}`, {
      cause: error,
    });
  }
}

function resolveConnection(): { url: string; secret: string } {
  const envUrl = firstDefined([process.env.SUPABASE_URL]);
  if (envUrl !== undefined) {
    assertLocalDevelopmentSupabaseUrl(envUrl);
  }

  const status = readStatusEnv();
  const statusUrl = firstDefined([
    status.get("API_URL"),
    status.get("SUPABASE_URL"),
  ]);
  if (statusUrl === undefined) {
    throw new Error(
      "supabase status did not report a local API URL. Start the local stack before bootstrapping auth.",
    );
  }

  const url = resolveLocalBootstrapDestination({
    requestedUrl: envUrl,
    statusUrl,
  });
  const secret = firstDefined([
    process.env.SUPABASE_SECRET_KEY,
    status.get("SUPABASE_SECRET_KEY"),
    status.get("SECRET_KEY"),
    status.get("SERVICE_ROLE_KEY"),
  ]);
  if (secret === undefined) {
    throw new Error(
      "Missing local Supabase secret. Set SUPABASE_SECRET_KEY, or start the local stack so supabase status can provide it.",
    );
  }

  return { url, secret };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function readStringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const direct = value[field];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }
  const nested = value.user;
  if (isRecord(nested)) {
    const nestedValue = nested[field];
    if (typeof nestedValue === "string" && nestedValue.length > 0) {
      return nestedValue;
    }
  }
  return undefined;
}

async function requestJson(
  url: string,
  secret: string,
  path: string,
  method: string,
  body?: JsonRecord,
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers();
  headers.set("apikey", secret);
  headers.set("authorization", `Bearer ${secret}`);
  headers.set("content-type", "application/json");
  headers.set("accept", "application/json");
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (text.length === 0) {
    return { status: response.status, body: null };
  }
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, body: text };
  }
}

function alreadyExists(status: number, body: unknown): boolean {
  if (status !== 409 && status !== 422) {
    return false;
  }
  const text = JSON.stringify(body).toLowerCase();
  return (
    text.includes("already") ||
    text.includes("exists") ||
    text.includes("duplicate") ||
    text.includes("email_exists") ||
    text.includes("user_already_exists")
  );
}

async function findUserIdByEmail(
  url: string,
  secret: string,
  email: string,
): Promise<string | undefined> {
  const listed = await requestJson(
    url,
    secret,
    "/auth/v1/admin/users?page=1&per_page=200",
    "GET",
  );
  if (
    listed.status !== 200 ||
    !isRecord(listed.body) ||
    !Array.isArray(listed.body.users)
  ) {
    return undefined;
  }
  for (const user of listed.body.users) {
    if (!isRecord(user)) {
      continue;
    }
    if (user.email === email && typeof user.id === "string") {
      return user.id;
    }
  }
  return undefined;
}

async function ensureLoginUser(
  url: string,
  secret: string,
  id: string,
  email: string,
): Promise<void> {
  const existing = await requestJson(
    url,
    secret,
    `/auth/v1/admin/users/${id}`,
    "GET",
  );
  if (existing.status === 200) {
    return;
  }
  const created = await requestJson(
    url,
    secret,
    "/auth/v1/admin/users",
    "POST",
    {
      id,
      email,
      email_confirm: true,
      password: LOCAL_PASSWORD,
    },
  );
  if (created.status === 200 || created.status === 201) {
    return;
  }
  if (alreadyExists(created.status, created.body)) {
    const foundId = await findUserIdByEmail(url, secret, email);
    if (foundId === id || existing.status === 200) {
      return;
    }
    if (foundId === undefined) {
      return;
    }
    throw new Error(`${email} already exists with a different id`);
  }
  throw new Error(
    `create user ${email} failed: ${created.status} ${redact(JSON.stringify(created.body))}`,
  );
}

async function upsertRow(
  url: string,
  secret: string,
  table: string,
  onConflict: string,
  row: JsonRecord,
): Promise<void> {
  const headers = new Headers();
  headers.set("apikey", secret);
  headers.set("authorization", `Bearer ${secret}`);
  headers.set("content-type", "application/json");
  headers.set("prefer", "resolution=merge-duplicates,return=minimal");
  const response = await fetch(
    `${url}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(row),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `upsert ${table} failed: ${response.status} ${redact(text)}`,
    );
  }
}

async function verifyMember(url: string, secret: string): Promise<void> {
  const result = await requestJson(
    url,
    secret,
    `/auth/v1/admin/users/${MEMBER_ID}`,
    "GET",
  );
  const id = readStringField(result.body, "id");
  const email = readStringField(result.body, "email");
  const confirmed = readStringField(result.body, "email_confirmed_at");
  if (result.status !== 200 || id !== MEMBER_ID || email !== MEMBER_EMAIL) {
    throw new Error(`member user lookup failed: ${result.status}`);
  }
  console.log(
    `member_exists id=${id} email=${email} email_confirmed=${confirmed === undefined ? "false" : "true"}`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg !== "--verify-member") {
      throw new Error("Unknown argument. Supported flag: --verify-member");
    }
  }
  const { url, secret } = resolveConnection();
  if (args.includes("--verify-member")) {
    await verifyMember(url, secret);
    return;
  }

  await ensureLoginUser(url, secret, MEMBER_ID, MEMBER_EMAIL);
  await ensureLoginUser(url, secret, OUTSIDER_ID, OUTSIDER_EMAIL);
  await ensureLoginUser(url, secret, GUARDIAN_ID, GUARDIAN_EMAIL);

  await upsertRow(url, secret, "profiles", "user_id", {
    user_id: MEMBER_ID,
    display_name: "Local Member",
    first_name: "Local",
    last_name: "Member",
    email: MEMBER_EMAIL,
    locale: "en-AU",
  });
  await upsertRow(url, secret, "profiles", "user_id", {
    user_id: OUTSIDER_ID,
    display_name: "Local Outsider",
    first_name: "Local",
    last_name: "Outsider",
    email: OUTSIDER_EMAIL,
    locale: "en-AU",
  });
  await upsertRow(url, secret, "profiles", "user_id", {
    user_id: GUARDIAN_ID,
    display_name: "Local Guardian",
    first_name: "Local",
    last_name: "Guardian",
    email: GUARDIAN_EMAIL,
    locale: "en-AU",
  });
  await upsertRow(url, secret, "club_memberships", "id", {
    id: MEMBERSHIP_ID,
    club_id: CLUB_ID,
    user_id: MEMBER_ID,
    role: "CLUB_ADMIN",
    active: true,
  });

  console.log("bootstrapped local auth users");
  console.log(`member ${MEMBER_ID} ${MEMBER_EMAIL}`);
  console.log(`outsider ${OUTSIDER_ID} ${OUTSIDER_EMAIL}`);
  console.log(`guardian ${GUARDIAN_ID} ${GUARDIAN_EMAIL}`);
  console.log("club membership CLUB_ADMIN for member only");
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "bootstrap failed";
  console.error(redact(message));
  process.exitCode = 1;
}
