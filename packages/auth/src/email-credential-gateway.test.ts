import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  createSupabaseEmailCredentialGateway,
  type EmailCredentialApi,
} from "./email-credential-gateway.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const redirectTo = "http://127.0.0.1:3000/auth/callback";

describe("supabase email credential gateway", () => {
  it("updates only the email and hides the provider user payload", async () => {
    const api = fakeApi();
    const gateway = createSupabaseEmailCredentialGateway(api.api);

    const started = await gateway.requestEmailChange({
      email: "next@local.stable.test",
      redirectTo,
    });

    expect(started).toEqual({ userId });
    expect(api.attributes).toEqual([{ email: "next@local.stable.test" }]);
    expect(api.redirects).toEqual([redirectTo]);
    expect(Object.keys(started)).toEqual(["userId"]);
  });

  it("reports the credential established only when the mailbox has committed", async () => {
    const pending = createSupabaseEmailCredentialGateway(
      fakeApi({
        email: "current@local.stable.test",
        newEmail: "next@local.stable.test",
      }).api,
    );
    const committed = createSupabaseEmailCredentialGateway(
      fakeApi({ email: "Next@local.stable.test", newEmail: "" }).api,
    );
    const missing = createSupabaseEmailCredentialGateway(fakeApi().api);

    await expect(
      pending.verifyEmailChange({
        email: "next@local.stable.test",
        token: "654321",
      }),
    ).resolves.toEqual({ userId, established: false });
    await expect(
      committed.verifyEmailChange({
        email: "next@local.stable.test",
        token: "654321",
      }),
    ).resolves.toEqual({ userId, established: true });
    await expect(
      createSupabaseEmailCredentialGateway(
        fakeApi({ email: "next@local.stable.test" }).api,
      ).verifyEmailChange({
        email: "next@local.stable.test",
        token: "654321",
      }),
    ).resolves.toEqual({ userId, established: true });
    await expect(
      missing.verifyEmailChange({
        email: "next@local.stable.test",
        token: "654321",
      }),
    ).resolves.toEqual({ userId, established: false });
    await expect(
      createSupabaseEmailCredentialGateway(
        fakeApi({ email: "next@local.stable.test", newEmail: null }).api,
      ).verifyEmailChange({
        email: "next@local.stable.test",
        token: "654321",
      }),
    ).resolves.toEqual({ userId, established: true });
  });

  it("rethrows provider failures and a missing adult", async () => {
    const failed = fakeApi({
      updateError: { code: "email_exists", message: "already registered" },
    });
    const absent = fakeApi({ user: null });

    await expect(
      createSupabaseEmailCredentialGateway(failed.api).requestEmailChange({
        email: "next@local.stable.test",
        redirectTo,
      }),
    ).rejects.toEqual(failed.updateError);
    await expect(
      createSupabaseEmailCredentialGateway(absent.api).requestEmailChange({
        email: "next@local.stable.test",
        redirectTo,
      }),
    ).rejects.toThrow("Email change could not be started.");
    await expect(
      createSupabaseEmailCredentialGateway(
        fakeApi({ verifyError: { code: "otp_expired" } }).api,
      ).verifyEmailChange({
        email: "next@local.stable.test",
        token: "654321",
      }),
    ).rejects.toEqual({ code: "otp_expired" });
    await expect(
      createSupabaseEmailCredentialGateway(
        fakeApi({ readError: { code: "session_not_found" } }).api,
      ).verifyEmailChange({
        email: "next@local.stable.test",
        token: "654321",
      }),
    ).rejects.toEqual({ code: "session_not_found" });
    await expect(
      createSupabaseEmailCredentialGateway(absent.api).verifyEmailChange({
        email: "next@local.stable.test",
        token: "654321",
      }),
    ).rejects.toThrow("Email change could not be checked.");
  });

  it("does not expose a phone update on the adapter", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "email-credential-gateway.ts",
      ),
      "utf8",
    );
    expect(source.includes("phone")).toBe(false);
  });
});

function fakeApi(input?: {
  email?: string;
  newEmail?: string | null;
  user?: null;
  updateError?: unknown;
  verifyError?: unknown;
  readError?: unknown;
}): {
  api: EmailCredentialApi;
  attributes: Array<{ email: string }>;
  redirects: string[];
  updateError: unknown;
} {
  const state = {
    attributes: [] as Array<{ email: string }>,
    redirects: [] as string[],
  };
  const user =
    input?.user === null
      ? null
      : {
          id: userId,
          ...(input?.email === undefined ? {} : { email: input.email }),
          ...(input?.newEmail === undefined
            ? {}
            : { new_email: input.newEmail }),
        };
  return {
    api: {
      async updateUser(attributes, options) {
        state.attributes.push(attributes);
        state.redirects.push(options.emailRedirectTo);
        if (input?.updateError !== undefined) {
          return { data: { user: null }, error: input.updateError };
        }
        return { data: { user }, error: null };
      },
      async verifyOtp() {
        if (input?.verifyError !== undefined) {
          return { data: { user: null }, error: input.verifyError };
        }
        return {
          data: { user: user === null ? null : { id: user.id } },
          error: null,
        };
      },
      async getUser() {
        if (input?.readError !== undefined) {
          return { data: { user: null }, error: input.readError };
        }
        return { data: { user }, error: null };
      },
    },
    attributes: state.attributes,
    redirects: state.redirects,
    updateError: input?.updateError,
  };
}
