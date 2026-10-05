import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTH_ERROR_MESSAGES } from "@stable/contracts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  MANUAL_LINKING_IS_ENABLED,
  createSupabaseOtpAuthClient,
  mapAuthError,
  requestEmailSignIn,
  requestPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
  type OtpAuthClient,
} from "./index.js";
import type {
  EmailOtpRequest,
  PhoneOtpRequest,
  VerifyEmailOtp,
  VerifyPhoneOtp,
} from "./otp-auth-client.js";

const LOCAL_EMAIL = "link-adult@local.stable.test";
const WEB_CALLBACK = "http://127.0.0.1:3000/auth/callback";
const INBUCKET = "http://127.0.0.1:54324";
const MEMBER_EMAIL = "member@local.stable.test";

function readEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for the local identity proof.`);
  }
  if (value.startsWith("sb_secret_") || value.includes("service_role")) {
    throw new Error(`${name} must be the local publishable key.`);
  }
  return value;
}

const supabaseUrl = readEnv("SUPABASE_URL");
const publishableKey = readEnv("SUPABASE_PUBLISHABLE_KEY");

if (!supabaseUrl.startsWith("http://127.0.0.1:")) {
  throw new Error("Local identity proof refuses a non-loopback Supabase URL.");
}

describe("local identity stability", () => {
  it("keeps email and phone adults, profiles, and memberships distinct", async () => {
    const membershipsBefore = sqlCount(
      "select count(*) from public.club_memberships",
    );
    const memberMembershipsBefore = sqlCount(
      `select count(*) from public.club_memberships m join auth.users u on u.id = m.user_id where u.email = '${MEMBER_EMAIL}'`,
    );
    expect(memberMembershipsBefore).toBeGreaterThan(0);

    const email = localClient();
    const phone = localClient();
    const phoneOtp = localPhoneOtp();

    await clearLocalMail();
    await waitForEmailGap();
    await requestEmailSignIn(email.otp, {
      email: LOCAL_EMAIL,
      redirectTo: WEB_CALLBACK,
      appEnv: "local",
    });
    const first = await verifyEmailOtp(email.otp, {
      email: LOCAL_EMAIL,
      token: await emailCode(LOCAL_EMAIL),
    });
    if (first.state !== "authenticated") {
      throw new Error("Email sign-in did not authenticate.");
    }
    const emailUserId = first.principal.userId;
    expect(
      sqlFlag(
        `select (email_confirmed_at is not null) from auth.users where id = '${assertUuid(emailUserId)}'`,
      ),
    ).toBe(true);

    await clearLocalMail();
    await waitForEmailGap();
    await requestEmailSignIn(email.otp, {
      email: LOCAL_EMAIL,
      redirectTo: WEB_CALLBACK,
      appEnv: "local",
    });
    const second = await verifyEmailOtp(email.otp, {
      email: LOCAL_EMAIL,
      token: await emailCode(LOCAL_EMAIL),
    });
    expect(second).toMatchObject({
      state: "authenticated",
      principal: { userId: emailUserId },
    });
    expect(identityCount(emailUserId)).toBe(1);

    await requestPhoneOtp(phone.otp, { phone: "0400000000" });
    const phoneSnapshot = await verifyPhoneOtp(phone.otp, {
      phone: "0400 000 000",
      token: phoneOtp.code,
    });
    if (phoneSnapshot.state !== "authenticated") {
      throw new Error("Phone sign-in did not authenticate.");
    }
    const phoneUserId = phoneSnapshot.principal.userId;
    expect(phoneUserId).not.toBe(emailUserId);
    expect(
      sqlFlag(
        `select (phone_confirmed_at is not null) from auth.users where id = '${assertUuid(phoneUserId)}'`,
      ),
    ).toBe(true);
    expect(identityCount(phoneUserId)).toBe(1);
    expect(profileCount(emailUserId)).toBe(0);
    expect(profileCount(phoneUserId)).toBe(0);
    expect(membershipCount(emailUserId)).toBe(0);
    expect(membershipCount(phoneUserId)).toBe(0);

    const collision = await email.supabase.auth.updateUser({
      phone: phoneOtp.phone,
    });
    const mappedCollision = mapAuthError(collision.error);
    expect(mappedCollision.code).toBe("CONFLICT");
    expect(mappedCollision.message).toBe(AUTH_ERROR_MESSAGES.CONFLICT);
    expect(JSON.stringify(mappedCollision).includes(phoneOtp.phone)).toBe(
      false,
    );
    expect(identityCount(emailUserId)).toBe(1);
    expect(identityCount(phoneUserId)).toBe(1);
    expect(profileCount(emailUserId)).toBe(0);

    const current = await email.supabase.auth.getUser();
    const identity = current.data.user?.identities?.[0];
    if (current.data.user?.id !== emailUserId || identity === undefined) {
      throw new Error("Email adult session did not survive the collision.");
    }
    const unlinked = await email.supabase.auth.unlinkIdentity(identity);
    const mappedUnlink = mapAuthError(unlinked.error);
    expect(mappedUnlink.code).toBe("CONFLICT");
    expect(mappedUnlink.message).toBe(AUTH_ERROR_MESSAGES.CONFLICT);
    expect(JSON.stringify(mappedUnlink).includes(identity.id)).toBe(false);
    expect(JSON.stringify(mappedUnlink).includes("Manual linking")).toBe(false);
    expect(identityCount(emailUserId)).toBe(1);

    expect(sqlCount("select count(*) from public.club_memberships")).toBe(
      membershipsBefore,
    );
    expect(
      sqlCount(
        `select count(*) from public.club_memberships m join auth.users u on u.id = m.user_id where u.email = '${MEMBER_EMAIL}'`,
      ),
    ).toBe(memberMembershipsBefore);
    expect(manualLinkingEnabledInConfig()).toBe(false);
    expect(MANUAL_LINKING_IS_ENABLED).toBe(false);

    await email.supabase.auth.signOut({ scope: "local" });
    await phone.supabase.auth.signOut({ scope: "local" });
  }, 60_000);
});

function localClient(): { supabase: SupabaseClient; otp: OtpAuthClient } {
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  const otp = createSupabaseOtpAuthClient({
    async signInWithOtp(credentials: EmailOtpRequest | PhoneOtpRequest) {
      if ("phone" in credentials) {
        const result = await supabase.auth.signInWithOtp({
          phone: credentials.phone,
          options: credentials.options,
        });
        return { error: result.error };
      }
      const result = await supabase.auth.signInWithOtp({
        email: credentials.email,
        options: credentials.options,
      });
      return { error: result.error };
    },
    async verifyOtp(params: VerifyEmailOtp | VerifyPhoneOtp) {
      if ("phone" in params) {
        return supabase.auth.verifyOtp({
          phone: params.phone,
          token: params.token,
          type: "sms",
        });
      }
      return supabase.auth.verifyOtp({
        email: params.email,
        token: params.token,
        type: "email",
      });
    },
    exchangeCodeForSession(code: string) {
      return supabase.auth.exchangeCodeForSession(code);
    },
  });
  return { supabase, otp };
}

function localPhoneOtp(): { phone: string; code: string } {
  const toml = readConfig();
  const match = /\[auth\.sms\.test_otp\][\s\S]*?\n(\d+)\s*=\s*"(\d{6})"/u.exec(
    toml,
  );
  const national = match?.[1];
  const code = match?.[2];
  if (
    national === undefined ||
    code === undefined ||
    !national.startsWith("614")
  ) {
    throw new Error("Local phone test OTP is not configured.");
  }
  return { phone: `+${national}`, code };
}

function manualLinkingEnabledInConfig(): boolean {
  const match = /^enable_manual_linking\s*=\s*(true|false)\s*$/mu.exec(
    readConfig(),
  );
  return match?.[1] === "true";
}

function readConfig(): string {
  return readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../supabase/config.toml",
    ),
    "utf8",
  );
}

function identityCount(userId: string): number {
  return sqlCount(
    `select count(*) from auth.identities where user_id = '${assertUuid(userId)}'`,
  );
}

function profileCount(userId: string): number {
  return sqlCount(
    `select count(*) from public.profiles where user_id = '${assertUuid(userId)}'`,
  );
}

function membershipCount(userId: string): number {
  return sqlCount(
    `select count(*) from public.club_memberships where user_id = '${assertUuid(userId)}'`,
  );
}

function sqlCount(statement: string): number {
  const value = Number(sqlScalar(statement));
  if (!Number.isInteger(value)) {
    throw new Error("Local identity rows could not be read.");
  }
  return value;
}

function sqlFlag(statement: string): boolean {
  const value = sqlScalar(statement);
  if (value !== "t" && value !== "f") {
    throw new Error("Local identity rows could not be read.");
  }
  return value === "t";
}

function sqlScalar(statement: string): string {
  try {
    return execFileSync(
      "docker",
      [
        "exec",
        "supabase_db_stable",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-t",
        "-A",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        statement,
      ],
      { encoding: "utf8" },
    ).trim();
  } catch {
    throw new Error("Local identity rows could not be read.");
  }
}

function assertUuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new Error("Local identity proof received an invalid user id.");
  }
  return value;
}

async function clearLocalMail(): Promise<void> {
  const cleared = await fetch(`${INBUCKET}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!cleared.ok) {
    throw new Error("Local email capture could not be cleared.");
  }
}

function waitForMail(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
}

function waitForEmailGap(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 1_200);
  });
}

async function emailCode(address: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const body = await capturedEmailBody(address);
    const labeled =
      body === null
        ? null
        : (/code:\s*(\d{6})/iu.exec(body) ??
          /enter the code:\s*(\d{6})/iu.exec(body));
    const code =
      labeled?.[1] ??
      (body === null ? undefined : /\b(\d{6})\b/u.exec(body)?.[1]);
    if (code !== undefined) {
      return code;
    }
    await waitForMail();
  }
  throw new Error("The local email did not include a sign-in code.");
}

async function capturedEmailBody(address: string): Promise<string | null> {
  const listed = await fetch(`${INBUCKET}/api/v1/messages`);
  if (!listed.ok) {
    throw new Error("Local email capture is unavailable.");
  }
  const payload: unknown = await listed.json();
  const message = newestMessage(readMessages(payload), address);
  if (message === undefined) {
    return null;
  }
  const detail = await fetch(`${INBUCKET}/api/v1/message/${message.id}`);
  if (!detail.ok) {
    throw new Error("Local email capture could not be read.");
  }
  return readBody(await detail.json());
}

function newestMessage(
  messages: Array<{ id: string; recipients: string[]; created: string }>,
  address: string,
): { id: string } | undefined {
  const matches = messages.filter((item) =>
    item.recipients.some((recipient) => recipient.toLowerCase() === address),
  );
  matches.sort((left, right) => (left.created < right.created ? 1 : -1));
  return matches[0];
}

function readMessages(
  payload: unknown,
): Array<{ id: string; recipients: string[]; created: string }> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("messages" in payload)
  ) {
    return [];
  }
  const messages: unknown = payload.messages;
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.flatMap((message) => {
    if (typeof message !== "object" || message === null) {
      return [];
    }
    const id = stringField(message, "ID") ?? stringField(message, "id");
    if (id === undefined) {
      return [];
    }
    return [
      {
        id,
        recipients: recipientAddresses(message),
        created: stringField(message, "Created") ?? "",
      },
    ];
  });
}

function recipientAddresses(message: object): string[] {
  const list = arrayField(message, "To") ?? [];
  const recipients: string[] = [];
  for (const recipient of list) {
    if (typeof recipient !== "object" || recipient === null) {
      continue;
    }
    const address = stringField(recipient, "Address");
    if (address !== undefined) {
      recipients.push(address);
    }
  }
  return recipients;
}

function readBody(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }
  return stringField(payload, "Text") ?? "";
}

function arrayField(value: object, key: string): unknown[] | undefined {
  const field = recordField(value, key);
  return Array.isArray(field) ? field : undefined;
}

function stringField(value: object, key: string): string | undefined {
  const field = recordField(value, key);
  return typeof field === "string" ? field : undefined;
}

function recordField(value: object, key: string): unknown {
  const record: Record<string, unknown> = {};
  Object.assign(record, value);
  return record[key];
}
