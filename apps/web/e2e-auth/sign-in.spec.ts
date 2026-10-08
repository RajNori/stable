import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const INBUCKET = localInbucketUrl();

function localInbucketUrl(): string {
  const value = process.env.LOCAL_INBUCKET_URL ?? "http://127.0.0.1:54324";
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    (url.hostname !== "127.0.0.1" && url.hostname !== "localhost")
  ) {
    throw new Error("LOCAL_INBUCKET_URL must use a loopback HTTP origin.");
  }
  return url.origin;
}

test.describe.configure({ mode: "serial", timeout: 60_000 });

test("email code signs an adult into club administration", async ({ page }) => {
  const email = `auth-ux-${Date.now()}@local.stable.test`;
  await clearLocalMail();
  await wait(1_200);
  await openEmail(page, email);
  const code = await emailCode(email);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Know what's next. Show up ready." }),
  ).toHaveCount(0);
  expect(page.url().includes(code)).toBe(false);
});

test("phone code signs an adult into club administration", async ({ page }) => {
  await wait(5_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with mobile" }).click();
  await page.getByLabel("Mobile number").fill("0400000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("6-digit code").fill(localPhoneCode());
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  await expect(page.getByText("0400000000")).toHaveCount(0);
});

test("magic link returns to the app without exposing the code", async ({
  page,
}) => {
  const email = `auth-link-${Date.now()}@local.stable.test`;
  let consumedCallback: string | null = null;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/auth/callback" && url.searchParams.has("code")) {
      consumedCallback = url.href;
    }
  });
  await clearLocalMail();
  await wait(1_200);
  await openEmail(page, email);
  const link = await emailLink(email);
  await page.goto(link);

  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/?$/);
  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  expect(page.url().includes("access_token")).toBe(false);
  expect(page.url().includes("code=")).toBe(false);

  if (consumedCallback === null) {
    throw new Error("The magic link did not visit the app callback route.");
  }
  await page.goto(consumedCallback);
  await expect(page).toHaveURL(/\/?auth=validation$/u);
  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  expect(page.url().includes("code=")).toBe(false);
});

test("sign out returns to the auth entry", async ({ page }) => {
  const email = `auth-out-${Date.now()}@local.stable.test`;
  await clearLocalMail();
  await wait(1_200);
  await openEmail(page, email);
  await page.getByLabel("6-digit code").fill(await emailCode(email));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Know what's next. Show up ready." }),
  ).toBeVisible();
});

async function openEmail(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("6-digit code")).toBeVisible();
}

function localPhoneCode(): string {
  const toml = readFileSync(
    join(process.cwd(), "../../supabase/config.toml"),
    "utf8",
  );
  const code = /\[auth\.sms\.test_otp\][\s\S]*?\n\d+\s*=\s*"(\d{6})"/u.exec(
    toml,
  )?.[1];
  if (code === undefined) {
    throw new Error("Local phone test OTP is not configured.");
  }
  return code;
}

async function emailCode(address: string): Promise<string> {
  const body = await latestEmailBody(address);
  const code =
    /code:\s*(\d{6})/iu.exec(body)?.[1] ?? /\b(\d{6})\b/u.exec(body)?.[1];
  if (code === undefined) {
    throw new Error("The local email did not include a sign-in code.");
  }
  return code;
}

async function emailLink(address: string): Promise<string> {
  const body = (await latestEmailBody(address)).replaceAll("&amp;", "&");
  const link = /https?:\/\/[^\s"'<>]+/u.exec(body)?.[0];
  if (link === undefined) {
    throw new Error("The local email did not include a sign-in link.");
  }
  return link;
}

async function latestEmailBody(address: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const body = await capturedEmailBody(address);
    if (body !== null) {
      return body;
    }
    await wait(500);
  }
  throw new Error("Local email capture has no message for the adult.");
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
): { id: string; recipients: string[]; created: string } | undefined {
  return messages
    .filter((message) =>
      message.recipients.some(
        (recipient) => recipient.toLowerCase() === address,
      ),
    )
    .sort((left, right) => right.created.localeCompare(left.created))[0];
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
    const created =
      stringField(message, "Created") ?? stringField(message, "created") ?? "";
    return [{ id, recipients: recipientAddresses(message), created }];
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

async function clearLocalMail(): Promise<void> {
  const cleared = await fetch(`${INBUCKET}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!cleared.ok) {
    throw new Error("Local email capture could not be cleared.");
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
