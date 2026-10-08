import { describe, expect, it } from "vitest";

import {
  refreshWebAuthSession,
  restoreWebAuthSession,
  signOutLiveWebAuthSession,
  signOutWebAuthSession,
  webAuthSessionGatewayFromSupabase,
  type WebAuthClient,
} from "./auth-session";
import type { SupabaseClient } from "@supabase/supabase-js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = 1_700_000_000_000;
const leakedToken = "secret-access-token";
const leakedEmail = "person@example.com";

describe("web auth session", () => {
  it("resolves an authenticated principal from getUser without cookie material", async () => {
    const client = fakeClient({
      user: {
        id: userId,
        user_metadata: {
          display_name: "Alex M",
          access_token: leakedToken,
          cookie: "sb-access-token",
        },
      },
    });

    const snapshot = await restoreWebAuthSession(client, now);

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(JSON.stringify(snapshot)).not.toContain(leakedToken);
    expect(JSON.stringify(snapshot)).not.toContain("sb-access-token");
    expect(client.userCalls).toBe(1);
    expect(client.refreshCalls).toBe(0);
  });

  it("returns unauthenticated when the browser has no auth session", async () => {
    const client = fakeClient({
      user: null,
      readError: {
        name: "AuthSessionMissingError",
        status: 400,
        message: "Auth session missing!",
      },
    });

    const snapshot = await restoreWebAuthSession(client);

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(JSON.stringify(snapshot).includes("Auth session missing")).toBe(
      false,
    );
  });

  it("returns unauthenticated when getUser has no user", async () => {
    const client = fakeClient({ user: null });

    const snapshot = await restoreWebAuthSession(client);

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(client.scopes).toEqual([]);
  });

  it("clears a corrupt cookie without echoing it", async () => {
    const client = fakeClient({
      user: null,
      readError: new SyntaxError("cookie sb-refresh-token is malformed"),
    });

    const snapshot = await restoreWebAuthSession(client, now);

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(JSON.stringify(snapshot)).not.toContain("sb-refresh-token");
    expect(client.scopes).toEqual(["local"]);
  });

  it("reports expired when the server rejects the session", async () => {
    const client = fakeClient({
      user: null,
      readError: { status: 401, code: "session_expired", message: leakedToken },
    });

    const snapshot = await restoreWebAuthSession(client, now);

    expect(snapshot).toEqual({ state: "expired" });
    expect(JSON.stringify(snapshot)).not.toContain(leakedToken);
  });

  it("does not report logout when the provider is unavailable", async () => {
    const client = fakeClient({
      user: {
        id: userId,
        user_metadata: { display_name: "Alex M" },
      },
      refreshError: { status: 503, message: `Apple down ${leakedEmail}` },
    });

    const snapshot = await refreshWebAuthSession(client, now);

    expect(snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(snapshot)).not.toContain(leakedEmail);
    expect(client.scopes).toEqual([]);
  });

  it("returns recovery when a provider returns a verified user together with an error", async () => {
    const client = fakeClient({
      user: { id: userId },
      readErrorWithUser: { status: 503, message: leakedEmail },
    });

    const snapshot = await restoreWebAuthSession(client, now);

    expect(snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(snapshot)).not.toContain(leakedEmail);
  });

  it("keeps a missing display name absent from the principal", async () => {
    const snapshot = await restoreWebAuthSession(
      fakeClient({ user: { id: userId } }),
      now,
    );
    expect(snapshot).toEqual({ state: "authenticated", principal: { userId } });
  });

  it("omits a non-string or empty display name from the principal", async () => {
    const snapshot = await restoreWebAuthSession(
      fakeClient({ user: { id: userId, user_metadata: { display_name: 12 } } }),
      now,
    );
    expect(snapshot).toEqual({ state: "authenticated", principal: { userId } });
    const emptyName = await restoreWebAuthSession(
      fakeClient({ user: { id: userId, user_metadata: { display_name: "" } } }),
      now,
    );
    expect(emptyName).toEqual({
      state: "authenticated",
      principal: { userId },
    });
  });

  it("refreshes into an authenticated principal", async () => {
    const client = fakeClient({
      user: { id: userId },
      refreshed: {
        user: {
          id: userId,
          user_metadata: { display_name: "Alex M" },
        },
        expires_at: Math.floor(now / 1000) + 3600,
      },
    });

    const snapshot = await refreshWebAuthSession(client, now);

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
  });

  it("expires when refresh succeeds without returning a session", async () => {
    const client = fakeClient({ user: { id: userId }, refreshed: null });
    const snapshot = await refreshWebAuthSession(client, now);
    expect(snapshot).toEqual({ state: "expired" });
    expect(client.scopes).toEqual(["local"]);
  });

  it("clears local credentials when refresh reports corrupt session data", async () => {
    const client = fakeClient({
      user: { id: userId },
      refreshError: new SyntaxError("corrupt refresh cookie"),
    });
    const snapshot = await refreshWebAuthSession(client, now);
    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(client.scopes).toEqual(["local"]);
  });

  it("reports recovery when the refresh provider throws", async () => {
    const client = fakeClient({
      user: { id: userId },
      refreshThrow: new TypeError(`fetch failed ${leakedEmail}`),
    });
    const snapshot = await refreshWebAuthSession(client, now);
    expect(snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(snapshot)).not.toContain(leakedEmail);
  });

  it("reports recovery when corrupt credentials cannot be cleared locally", async () => {
    const client = fakeClient({
      user: null,
      readError: new SyntaxError("corrupt local cookie"),
      clearLocalError: new TypeError(
        `local storage unavailable ${leakedEmail}`,
      ),
    });
    const snapshot = await restoreWebAuthSession(client, now);
    expect(snapshot).toMatchObject({ state: "recovery" });
    expect(JSON.stringify(snapshot)).not.toContain(leakedEmail);
  });

  it("keeps the verified user when a rejected refresh leaves that user in place", async () => {
    const client = fakeClient({
      user: {
        id: userId,
        user_metadata: { display_name: "Alex M", access_token: leakedToken },
      },
      refreshError: { status: 401, code: "refresh_token_already_used" },
    });

    const snapshot = await refreshWebAuthSession(client, now);

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(client.scopes).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain(leakedToken);
  });

  it("expires the browser session when refresh is rejected and the user is gone", async () => {
    const client = fakeClient({
      user: null,
      refreshError: {
        status: 401,
        code: "refresh_token_not_found",
        message: leakedToken,
      },
    });

    const snapshot = await refreshWebAuthSession(client, now);

    expect(snapshot).toEqual({ state: "expired" });
    expect(client.scopes).toEqual(["local"]);
    expect(JSON.stringify(snapshot)).not.toContain(leakedToken);
  });

  it("signs out this browser with local scope", async () => {
    const client = fakeClient({
      user: { id: userId },
      signOutClears: true,
    });

    const snapshot = await signOutWebAuthSession(client, "local");

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(client.scopes).toEqual(["local"]);
  });

  it("does not claim success when the user is still readable", async () => {
    const client = fakeClient({
      user: {
        id: userId,
        user_metadata: { access_token: leakedToken },
      },
      signOutError: new TypeError(`Failed to fetch ${leakedEmail}`),
    });

    const snapshot = await signOutWebAuthSession(client, "global");

    expect(snapshot).toMatchObject({ state: "recovery" });
    expect(snapshot.state).not.toBe("unauthenticated");
    expect(client.scopes).toEqual(["global", "local"]);
    expect(JSON.stringify(snapshot)).not.toContain(leakedToken);
    expect(JSON.stringify(snapshot)).not.toContain(leakedEmail);
  });

  it("adapts Supabase user and refresh responses without preserving token fields", async () => {
    const supabase = {
      auth: {
        async getUser() {
          return {
            data: {
              user: {
                id: userId,
                user_metadata: {
                  display_name: "Alex M",
                  access_token: leakedToken,
                },
              },
            },
            error: null,
          };
        },
        async refreshSession() {
          return {
            data: {
              session: {
                user: { id: userId, user_metadata: { display_name: "Alex M" } },
                expires_at: Math.floor(now / 1000) + 60,
              },
            },
            error: null,
          };
        },
        async signOut() {
          return { error: null };
        },
      },
    } as unknown as SupabaseClient;

    const gateway = webAuthSessionGatewayFromSupabase(supabase);
    expect(await gateway.readPersisted()).toEqual({
      kind: "principal",
      principal: { userId, displayName: "Alex M", accessExpiresAt: null },
    });
    expect(await gateway.refresh()).toEqual({
      kind: "principal",
      principal: {
        userId,
        displayName: "Alex M",
        accessExpiresAt: (Math.floor(now / 1000) + 60) * 1000,
      },
    });
    await gateway.revoke("global");
    await gateway.clearLocal();
  });

  it("handles Supabase null and non-expiring responses and signs out the live client locally", async () => {
    let signedOut = false;
    let refreshCalls = 0;
    const supabase = {
      auth: {
        async getUser() {
          return {
            data: {
              user: signedOut ? null : { id: userId, user_metadata: null },
            },
            error: null,
          };
        },
        async refreshSession() {
          refreshCalls += 1;
          if (refreshCalls === 1) {
            return {
              data: {
                session: {
                  user: {
                    id: userId,
                    user_metadata: { display_name: "Alex M" },
                  },
                },
              },
              error: null,
            };
          }
          return { data: { session: null }, error: null };
        },
        async signOut({ scope }: { scope: string }) {
          expect(scope).toBe("local");
          signedOut = true;
          return { error: null };
        },
      },
    } as unknown as SupabaseClient;

    const gateway = webAuthSessionGatewayFromSupabase(supabase);
    expect(await gateway.refresh()).toEqual({
      kind: "principal",
      principal: { userId, displayName: "Alex M", accessExpiresAt: null },
    });
    expect(await gateway.refresh()).toEqual({ kind: "expired" });
    expect(await signOutLiveWebAuthSession(supabase)).toEqual({
      state: "unauthenticated",
    });
  });
});

function fakeClient(input: {
  user: { id: string; user_metadata?: unknown } | null;
  readError?: unknown;
  readErrorWithUser?: unknown;
  refreshed?: {
    user: { id: string; user_metadata?: unknown };
    expires_at?: number;
  } | null;
  refreshError?: unknown;
  refreshThrow?: unknown;
  signOutError?: unknown;
  clearLocalError?: unknown;
  signOutClears?: boolean;
}): WebAuthClient & {
  userCalls: number;
  refreshCalls: number;
  scopes: string[];
} {
  const state = {
    userCalls: 0,
    refreshCalls: 0,
    scopes: [] as string[],
    user: input.user,
  };
  const client: WebAuthClient = {
    auth: {
      async getUser() {
        state.userCalls += 1;
        if (input.readError instanceof SyntaxError) {
          throw input.readError;
        }
        if (input.readError !== undefined) {
          return { data: { user: null }, error: input.readError };
        }
        if (input.readErrorWithUser !== undefined) {
          return { data: { user: state.user }, error: input.readErrorWithUser };
        }
        return { data: { user: state.user }, error: null };
      },
      async refreshSession() {
        state.refreshCalls += 1;
        if (input.refreshThrow !== undefined) {
          throw input.refreshThrow;
        }
        if (input.refreshError !== undefined) {
          return { data: { session: null }, error: input.refreshError };
        }
        return {
          data: { session: input.refreshed ?? null },
          error: null,
        };
      },
      async signOut(options) {
        state.scopes.push(options.scope);
        if (input.clearLocalError !== undefined && options.scope === "local") {
          return { error: input.clearLocalError };
        }
        if (input.signOutError !== undefined && options.scope === "global") {
          return { error: input.signOutError };
        }
        if (input.signOutClears) {
          state.user = null;
        }
        return { error: null };
      },
    },
  };

  return {
    ...client,
    get userCalls() {
      return state.userCalls;
    },
    get refreshCalls() {
      return state.refreshCalls;
    },
    scopes: state.scopes,
  };
}
