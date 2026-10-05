import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApplicationError, type Principal } from "@stable/contracts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  EMAIL_CHANGE_MODE_BY_ENV,
  PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED,
  createSupabaseEmailCredentialGateway,
  createSupabaseOtpAuthClient,
  requestEmailCredentialChange,
  requestEmailSignIn,
  requestPhoneCredentialChange,
  verifyEmailCredentialChange,
  verifyEmailOtp,
  cancelEmailCredentialChange,
  type EmailCredentialApi,
  type OtpAuthClient,
} from "./index.js";
import type {
  EmailOtpRequest,
  PhoneOtpRequest,
  VerifyEmailOtp,
  VerifyPhoneOtp,
} from "./otp-auth-client.js";

const WEB_CALLBACK = "http://127.0.0.1:3000/auth/callback";
const INBUCKET = "http://127.0.0.1:54324";
const OWNED_EMAIL = "member@local.stable.test";

function readEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(
      `${name} is required for the local email credential proof.`,
    );
  }
  if (value.startsWith("sb_secret_") || value.includes("service_role")) {
    throw new Error(`${name} must be the local publishable key.`);
  }
  return value;
}

const supabaseUrl = readEnv("SUPABASE_URL");
const publishableKey = readEnv("SUPABASE_PUBLISHABLE_KEY");

if (!supabaseUrl.startsWith("http://127.0.0.1:")) {
  throw new Error(
    "Local email credential proof refuses a non-loopback Supabase URL.",
  );
}

describe("local email credential change", () => {
  it("verifies an email change without moving the adult", async () => {
    const suffix = Date.now().toString();
    const currentEmail = `email-change-${suffix}@local.stable.test`;
    const nextEmail = `email-change-next-${suffix}@local.stable.test`;
    const membershipsBefore = sqlCount(
      "select count(*) from public.club_memberships",
    );
    const session = localClient();

    await clearLocalMail();
    await requestEmailSignIn(session.otp, {
      email: currentEmail,
      redirectTo: WEB_CALLBACK,
      appEnv: "local",
    });
    const signedIn = await verifyEmailOtp(session.otp, {
      email: currentEmail,
      token: await emailCode(currentEmail),
    });
    if (signedIn.state !== "authenticated") {
      throw new Error("Email sign-in did not authenticate.");
    }
    const principal = signedIn.principal;
    const userId = principal.userId;
    expect(profileCount(userId)).toBe(0);
    expect(membershipCount(userId)).toBe(0);
    expect(identityCount(userId)).toBe(1);
    expect(EMAIL_CHANGE_MODE_BY_ENV.local).toBe("double_confirm");
    expect(PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED).toBe(false);
    expect(doubleConfirmChangesInConfig()).toBe(true);

    await expect(
      requestPhoneCredentialChange({ principal, phone: "0400000000" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mailbox(userId)).toBe(currentEmail);

    await expect(
      requestEmailCredentialChange(session.gateway, {
        principal,
        email: OWNED_EMAIL,
        redirectTo: WEB_CALLBACK,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This sign-in method can't be added.",
    });
    expect(mailbox(userId)).toBe(currentEmail);
    expect(pendingMailbox(userId)).toBe("");

    await clearLocalMail();
    await waitForEmailGap();
    const pending = await requestEmailCredentialChange(session.gateway, {
      principal,
      email: nextEmail,
      redirectTo: WEB_CALLBACK,
      appEnv: "local",
    });
    expect(pending).toEqual({ status: "pending", userId });
    expect(mailbox(userId)).toBe(currentEmail);
    expect(pendingMailbox(userId)).toBe(nextEmail);
    expect(cancelEmailCredentialChange(principal)).toEqual({
      state: "authenticated",
      principal,
    });
    expect(mailbox(userId)).toBe(currentEmail);

    const established = await confirmChange(
      session.gateway,
      principal,
      currentEmail,
      nextEmail,
    );
    expect(established).toEqual({ status: "established", userId });
    expect(mailbox(userId)).toBe(nextEmail);
    expect(pendingMailbox(userId)).toBe("");
    expect(profileCount(userId)).toBe(0);
    expect(membershipCount(userId)).toBe(0);
    expect(identityCount(userId)).toBe(1);
    expect(sqlCount("select count(*) from public.club_memberships")).toBe(
      membershipsBefore,
    );

    await session.supabase.auth.signOut({ scope: "local" });
  }, 90_000);
});

async function confirmChange(
  gateway: ReturnType<typeof createSupabaseEmailCredentialGateway>,
  principal: Principal,
  currentEmail: string,
  nextEmail: string,
): Promise<{ status: "pending" | "established"; userId: string }> {
  const nextCode = await emailCode(nextEmail);
  let verified: { status: "pending" | "established"; userId: string };
  try {
    verified = await verifyEmailCredentialChange(gateway, {
      principal,
      email: nextEmail,
      token: nextCode,
      appEnv: "local",
    });
  } catch (error) {
    if (
      !(error instanceof ApplicationError) ||
      error.code !== "VALIDATION_FAILED"
    ) {
      throw error;
    }
    verified = { status: "pending", userId: principal.userId };
  }
  if (verified.status === "established") {
    return verified;
  }
  const currentCode = await emailCode(currentEmail);
  return verifyEmailCredentialChange(gateway, {
    principal,
    email: currentEmail,
    token: currentCode,
    appEnv: "local",
  });
}

function localClient(): {
  supabase: SupabaseClient;
  otp: OtpAuthClient;
  gateway: ReturnType<typeof createSupabaseEmailCredentialGateway>;
} {
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
  const gateway = createSupabaseEmailCredentialGateway({
    async updateUser(attributes, options) {
      const result = await supabase.auth.updateUser(
        { email: attributes.email },
        options,
      );
      const user = result.data.user;
      return {
        data: { user: user === null ? null : { id: user.id } },
        error: result.error,
      };
    },
    async verifyOtp(params) {
      const result = await supabase.auth.verifyOtp(params);
      const user = result.data.user;
      return {
        data: { user: user === null ? null : { id: user.id } },
        error: result.error,
      };
    },
    async getUser() {
      const result = await supabase.auth.getUser();
      return {
        data: { user: accountFrom(result.data.user) },
        error: result.error,
      };
    },
  } satisfies EmailCredentialApi);
  return { supabase, otp, gateway };
}

function accountFrom(
  user: { id: string; email?: string; new_email?: string } | null,
): { id: string; email?: string; new_email?: string | null } | null {
  if (user === null) {
    return null;
  }
  const account: { id: string; email?: string; new_email?: string | null } = {
    id: user.id,
  };
  if (user.email !== undefined) {
    account.email = user.email;
  }
  if (user.new_email !== undefined) {
    account.new_email = user.new_email;
  }
  return account;
}

function doubleConfirmChangesInConfig(): boolean {
  return /^double_confirm_changes\s*=\s*true\s*$/mu.test(readConfig());
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

function mailbox(userId: string): string {
  return sqlScalar(
    `select coalesce(email, '') from auth.users where id = '${assertUuid(userId)}'`,
  );
}

function pendingMailbox(userId: string): string {
  return sqlScalar(
    `select coalesce(email_change, '') from auth.users where id = '${assertUuid(userId)}'`,
  );
}

function sqlCount(statement: string): number {
  const value = Number(sqlScalar(statement));
  if (!Number.isInteger(value)) {
    throw new Error("Local identity rows could not be read.");
  }
  return value;
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
    throw new Error(
      "Local email credential proof received an invalid user id.",
    );
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
  throw new Error("The local email did not include a confirmation code.");
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
  return `${stringField(payload, "Text") ?? ""}\n${stringField(payload, "HTML") ?? ""}`;
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
