import { expect, test } from "@playwright/test";

const INBUCKET = localInbucketUrl();

test("a rejected callback can recover through a fresh email code", async ({
  page,
}) => {
  const email = `auth-recovery-${crypto.randomUUID()}@local.stable.test`;

  // A previously consumed or malformed PKCE code must fail closed at the
  // callback boundary and leave the user at the sign-in entry.
  await page.goto("/auth/callback?code=stale-local-callback-code");
  await expect(page).toHaveURL(/\/?auth=validation$/u);
  await expect(
    page.getByText("The sign-in details could not be checked."),
  ).toBeVisible();
  await expect(page.getByTestId("club-admin-frame")).toHaveCount(0);

  // The failure is recoverable: request a new OTP and establish a session.
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("6-digit code")).toBeVisible();
  await page.getByLabel("6-digit code").fill(await emailCode(email));
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  expect(page.url()).not.toContain("stale-local-callback-code");
});

test("a transient auth network failure can recover through explicit retry", async ({
  page,
}) => {
  const email = `auth-network-${crypto.randomUUID()}@local.stable.test`;
  let otpRequests = 0;
  await page.route("**/auth/v1/otp**", async (route) => {
    otpRequests += 1;
    if (otpRequests === 1) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(
    page.getByText("Sign-in is unavailable right now."),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(email);
  expect(page.url()).not.toContain(email);
  await expect(page.getByTestId("club-admin-frame")).toHaveCount(0);

  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("6-digit code")).toBeVisible();
  await page.getByLabel("6-digit code").fill(await emailCode(email));
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  expect(otpRequests).toBe(2);
});

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

async function emailCode(address: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = await capturedEmailCode(address);
    if (code !== null) {
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "Local email capture has no message for the recovery account.",
  );
}

async function capturedEmailCode(address: string): Promise<string | null> {
  const listed = await fetch(`${INBUCKET}/api/v1/messages`);
  if (!listed.ok) {
    throw new Error("Local email capture is unavailable.");
  }
  const payload: unknown = await listed.json();
  const message = newestMessage(payload, address);
  if (message === null) {
    return null;
  }
  const detail = await fetch(`${INBUCKET}/api/v1/message/${message.id}`);
  if (!detail.ok) {
    throw new Error("Local email capture could not be read.");
  }
  const body = await detail.json();
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const text = stringField(body, "Text") ?? stringField(body, "text") ?? "";
  const html = stringField(body, "HTML") ?? stringField(body, "html") ?? "";
  const contents = `${text}\n${html}`;
  return (
    /code:\s*(\d{6})/iu.exec(contents)?.[1] ??
    /\b(\d{6})\b/u.exec(contents)?.[1] ??
    null
  );
}

function newestMessage(
  payload: unknown,
  address: string,
): { id: string; created: string } | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("messages" in payload) ||
    !Array.isArray(payload.messages)
  ) {
    return null;
  }
  const messages = payload.messages.flatMap((value) => {
    if (typeof value !== "object" || value === null) {
      return [];
    }
    const id = stringField(value, "ID") ?? stringField(value, "id");
    if (id === undefined) {
      return [];
    }
    const to = arrayField(value, "To") ?? arrayField(value, "to") ?? [];
    const matches = to.some((recipient) => {
      if (typeof recipient === "string") {
        return recipient.toLowerCase() === address;
      }
      if (typeof recipient !== "object" || recipient === null) {
        return false;
      }
      const recipientAddress =
        stringField(recipient, "Address") ?? stringField(recipient, "address");
      return recipientAddress?.toLowerCase() === address;
    });
    if (!matches) {
      return [];
    }
    return [
      {
        id,
        created:
          stringField(value, "Created") ?? stringField(value, "created") ?? "",
      },
    ];
  });
  return (
    messages.sort((left, right) =>
      right.created.localeCompare(left.created),
    )[0] ?? null
  );
}

function arrayField(value: object, key: string): unknown[] | undefined {
  const field = fieldValue(value, key);
  return Array.isArray(field) ? field : undefined;
}

function stringField(value: object, key: string): string | undefined {
  const field = fieldValue(value, key);
  return typeof field === "string" ? field : undefined;
}

function fieldValue(value: object, key: string): unknown {
  return (value as Record<string, unknown>)[key];
}
