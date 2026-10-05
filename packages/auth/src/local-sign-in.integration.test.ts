import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  completeEmailCallback,
  createSupabaseOtpAuthClient,
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

const LOCAL_EMAIL = "email-adult@local.stable.test";
const WEB_CALLBACK = "http://127.0.0.1:3000/auth/callback";
const INBUCKET = "http://127.0.0.1:54324";

function readEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for the local sign-in proof.`);
  }
  if (value.startsWith("sb_secret_") || value.includes("service_role")) {
    throw new Error(`${name} must be the local publishable key.`);
  }
  return value;
}

const supabaseUrl = readEnv("SUPABASE_URL");
const publishableKey = readEnv("SUPABASE_PUBLISHABLE_KEY");

if (!supabaseUrl.startsWith("http://127.0.0.1:")) {
  throw new Error("Local sign-in proof refuses a non-loopback Supabase URL.");
}

function localPhoneOtp(): { phone: string; otherCode: string } {
  const toml = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../supabase/config.toml",
    ),
    "utf8",
  );
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
  const otherCode = code === "000000" ? "111111" : "000000";
  return { phone: `+${national}`, otherCode };
}

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

describe("local email and phone sign-in", () => {
  it("signs in an adult with the email code and rejects a replay", async () => {
    const { supabase, otp } = localClient();
    const phone = localPhoneOtp();

    await clearLocalMail();
    await waitForEmailGap();
    await requestEmailSignIn(otp, {
      email: LOCAL_EMAIL,
      redirectTo: WEB_CALLBACK,
      appEnv: "local",
    });
    const firstCode = await emailCode(LOCAL_EMAIL);
    const first = await verifyEmailOtp(otp, {
      email: LOCAL_EMAIL,
      token: firstCode,
    });
    expect(first.state).toBe("authenticated");
    if (first.state !== "authenticated") {
      return;
    }
    expect(first.principal.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
    expect(JSON.stringify(first).includes(firstCode)).toBe(false);
    expect(JSON.stringify(first).includes(LOCAL_EMAIL)).toBe(false);
    expect(JSON.stringify(first).includes("access_token")).toBe(false);

    await expect(
      verifyEmailOtp(otp, { email: LOCAL_EMAIL, token: firstCode }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await supabase.auth.signOut({ scope: "local" });
    await clearLocalMail();
    await waitForEmailGap();
    await requestEmailSignIn(otp, {
      email: LOCAL_EMAIL,
      redirectTo: WEB_CALLBACK,
      appEnv: "local",
    });
    const second = await verifyEmailOtp(otp, {
      email: LOCAL_EMAIL,
      token: await emailCode(LOCAL_EMAIL),
    });
    expect(second).toMatchObject({
      state: "authenticated",
      principal: { userId: first.principal.userId },
    });

    await requestPhoneOtp(otp, { phone: "0400000000" });
    const phoneSnapshot = await verifyPhoneOtp(otp, {
      phone: "0400 000 000",
      token: phoneCode(),
    });
    expect(phoneSnapshot.state).toBe("authenticated");
    if (phoneSnapshot.state !== "authenticated") {
      return;
    }
    expect(phoneSnapshot.principal.userId).not.toBe(first.principal.userId);
    expect(JSON.stringify(phoneSnapshot).includes(phone.phone)).toBe(false);
    expect(JSON.stringify(phoneSnapshot).includes("refresh_token")).toBe(false);

    await supabase.auth.signOut({ scope: "local" });
    const samePhone = await verifyPhoneOtp(otp, {
      phone: "+61400000000",
      token: phoneCode(),
    });
    expect(samePhone).toMatchObject({
      state: "authenticated",
      principal: { userId: phoneSnapshot.principal.userId },
    });

    await expect(
      verifyPhoneOtp(otp, { phone: "0400000000", token: phone.otherCode }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  }, 60_000);

  it("completes the magic link through the local callback", async () => {
    const { supabase, otp } = localClient();
    await clearLocalMail();
    await waitForEmailGap();
    await requestEmailSignIn(otp, {
      email: LOCAL_EMAIL,
      redirectTo: WEB_CALLBACK,
      appEnv: "local",
    });
    const callbackUrl = await emailCallback(LOCAL_EMAIL);
    const completed = await completeEmailCallback(otp, {
      callbackUrl,
      appEnv: "local",
      returnTo: "/club-structure",
    });

    expect(completed.returnTo).toBe("/club-structure");
    expect(completed.snapshot.state).toBe("authenticated");
    expect(JSON.stringify(completed).includes("access_token")).toBe(false);
    expect(JSON.stringify(completed).includes(LOCAL_EMAIL)).toBe(false);
    await supabase.auth.signOut({ scope: "local" });
  }, 60_000);
});

function phoneCode(): string {
  const toml = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../supabase/config.toml",
    ),
    "utf8",
  );
  const match = /\[auth\.sms\.test_otp\][\s\S]*?\n\d+\s*=\s*"(\d{6})"/u.exec(
    toml,
  );
  const code = match?.[1];
  if (code === undefined) {
    throw new Error("Local phone test OTP is not configured.");
  }
  return code;
}

async function emailCode(address: string): Promise<string> {
  const body = await latestEmailBody(address);
  const labeled =
    /code:\s*(\d{6})/iu.exec(body) ?? /enter the code:\s*(\d{6})/iu.exec(body);
  const code = labeled?.[1] ?? /\b(\d{6})\b/u.exec(body)?.[1];
  if (code === undefined) {
    throw new Error("The local email did not include a sign-in code.");
  }
  return code;
}

async function emailCallback(address: string): Promise<string> {
  const body = (await latestEmailBody(address)).replaceAll("&amp;", "&");
  const link = /https?:\/\/[^\s"'<>]+/u.exec(body)?.[0];
  if (link === undefined) {
    throw new Error("The local email did not include a sign-in link.");
  }
  return followToLocalCallback(link);
}

async function followToLocalCallback(start: string): Promise<string> {
  let current = start;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (current.startsWith(WEB_CALLBACK)) {
      return current;
    }
    const response = await fetch(current, { redirect: "manual" });
    const location = response.headers.get("location");
    if (location === null) {
      break;
    }
    current = new URL(location, current).toString();
  }
  throw new Error("The local email link did not return to the app callback.");
}

async function clearLocalMail(): Promise<void> {
  const cleared = await fetch(`${INBUCKET}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!cleared.ok) {
    throw new Error("Local email capture could not be cleared.");
  }
}

async function latestEmailBody(address: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const body = await capturedEmailBody(address);
    if (body !== null) {
      return body;
    }
    await waitForMail();
  }
  throw new Error("Local email capture has no message for the adult.");
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
    const recipients = recipientAddresses(message);
    const created =
      stringField(message, "Created") ?? stringField(message, "created") ?? "";
    return [{ id, recipients, created }];
  });
}

function recipientAddresses(message: object): string[] {
  const list = arrayField(message, "To") ?? arrayField(message, "to") ?? [];
  const recipients: string[] = [];
  for (const recipient of list) {
    if (typeof recipient === "string") {
      recipients.push(recipient);
      continue;
    }
    if (typeof recipient !== "object" || recipient === null) {
      continue;
    }
    const address =
      stringField(recipient, "Address") ?? stringField(recipient, "address");
    if (address !== undefined) {
      recipients.push(address);
    }
  }
  return recipients;
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

function readBody(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }
  const text =
    stringField(payload, "Text") ?? stringField(payload, "text") ?? "";
  const html =
    stringField(payload, "HTML") ?? stringField(payload, "html") ?? "";
  return `${text}\n${html}`;
}
