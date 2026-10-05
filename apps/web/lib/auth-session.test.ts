import { describe, expect, it } from "vitest";

import {
  refreshWebAuthSession,
  restoreWebAuthSession,
  signOutWebAuthSession,
  type WebAuthClient,
} from "./auth-session";

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
});

function fakeClient(input: {
  user: { id: string; user_metadata?: unknown } | null;
  readError?: unknown;
  refreshed?: {
    user: { id: string; user_metadata?: unknown };
    expires_at?: number;
  } | null;
  refreshError?: unknown;
  signOutError?: unknown;
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
        return { data: { user: state.user }, error: null };
      },
      async refreshSession() {
        state.refreshCalls += 1;
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
