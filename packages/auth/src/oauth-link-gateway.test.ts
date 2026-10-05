import { describe, expect, it } from "vitest";

import {
  createSupabaseOAuthLinkGateway,
  type OAuthLinkApi,
} from "./oauth-link-gateway.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const redirectTo = "http://127.0.0.1:3000/auth/callback";
const leakedUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?access_token=secret-token";

describe("supabase oauth link gateway", () => {
  it("selects Google or Apple and drops the provider response", async () => {
    const google = fakeApi();
    const apple = fakeApi();

    await expect(
      createSupabaseOAuthLinkGateway(google.api).linkIdentity({
        provider: "google",
        redirectTo,
      }),
    ).resolves.toEqual({ userId });
    await expect(
      createSupabaseOAuthLinkGateway(apple.api).linkIdentity({
        provider: "apple",
        redirectTo,
      }),
    ).resolves.toEqual({ userId });

    expect(google.calls).toEqual([
      {
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      },
    ]);
    expect(apple.calls).toEqual([
      {
        provider: "apple",
        options: { redirectTo, skipBrowserRedirect: true },
      },
    ]);
    expect(JSON.stringify(google.calls).includes("access_token")).toBe(false);
  });

  it("rethrows provider failures and a missing adult", async () => {
    const failed = fakeApi({
      linkError: { code: "identity_already_exists", message: leakedUrl },
    });
    const absent = fakeApi({ user: null });

    await expect(
      createSupabaseOAuthLinkGateway(failed.api).linkIdentity({
        provider: "google",
        redirectTo,
      }),
    ).rejects.toEqual(failed.linkError);
    await expect(
      createSupabaseOAuthLinkGateway(absent.api).linkIdentity({
        provider: "apple",
        redirectTo,
      }),
    ).rejects.toThrow("OAuth link could not be checked.");
    await expect(
      createSupabaseOAuthLinkGateway(
        fakeApi({ readError: { code: "session_not_found" } }).api,
      ).linkIdentity({
        provider: "google",
        redirectTo,
      }),
    ).rejects.toEqual({ code: "session_not_found" });
  });
});

function fakeApi(input?: {
  linkError?: unknown;
  readError?: unknown;
  user?: null;
}): {
  api: OAuthLinkApi;
  calls: Array<{
    provider: "google" | "apple";
    options: { redirectTo: string; skipBrowserRedirect: true };
  }>;
  linkError: unknown;
} {
  const calls: Array<{
    provider: "google" | "apple";
    options: { redirectTo: string; skipBrowserRedirect: true };
  }> = [];
  return {
    api: {
      async linkIdentity(credentials) {
        calls.push(credentials);
        if (input?.linkError !== undefined) {
          return { data: { url: leakedUrl }, error: input.linkError };
        }
        return { data: { url: leakedUrl }, error: null };
      },
      async getUser() {
        if (input?.readError !== undefined) {
          return { data: { user: null }, error: input.readError };
        }
        if (input?.user === null) {
          return { data: { user: null }, error: null };
        }
        return { data: { user: { id: userId } }, error: null };
      },
    },
    calls,
    linkError: input?.linkError,
  };
}
