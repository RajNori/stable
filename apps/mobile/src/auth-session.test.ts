import {
  createLiveMobileAuthSessionGateway,
  mobileAuthSessionGatewayFromSupabase,
  mobileAuthStorageKey,
  refreshMobileAuthSession,
  restoreLiveMobileAuthSession,
  restoreMobileAuthSession,
  signOutLiveMobileAuthSession,
  signOutMobileAuthSession,
  type MobileAuthClient,
  type MobileAuthStorage,
} from "./auth-session";
declare const jest: {
  mock: (moduleName: string, factory: () => unknown) => void;
};

jest.mock("./supabase-client", () => ({
  getMobileSessionStorage: () => mockLiveMocks().storage,
  getMobileSupabaseClient: () => mockLiveMocks().client,
}));
jest.mock("./game-day-snapshot", () => ({
  secureGameDaySnapshotStore: () => mockLiveMocks().snapshotStore,
}));
jest.mock("./offline-context", () => ({
  clearStoredOfflineGameDay: (store: unknown, id: string) => {
    mockLiveMocks().offlineClearCalls.push([store, id]);
    return Promise.resolve();
  },
}));

type LiveMocks = {
  client: MobileAuthClient | undefined;
  storage: MobileAuthStorage | undefined;
  snapshotStore: MobileAuthStorage | undefined;
  offlineClearCalls: unknown[][];
};

function mockLiveMocks(): LiveMocks {
  const holder = globalThis as typeof globalThis & {
    __stableM5MobileAuthMocks?: LiveMocks;
  };
  holder.__stableM5MobileAuthMocks ??= {
    client: undefined,
    storage: undefined,
    snapshotStore: undefined,
    offlineClearCalls: [],
  };
  return holder.__stableM5MobileAuthMocks;
}

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storageKey = "sb-127-auth-token";
const now = 1_700_000_000_000;
const leakedToken = "secret-access-token";

describe("mobile auth session", () => {
  it("derives the secure-store key from the project host", () => {
    expect(mobileAuthStorageKey("http://127.0.0.1:54321")).toBe(
      "sb-127-auth-token",
    );
    expect(mobileAuthStorageKey("https://abcd.supabase.co")).toBe(
      "sb-abcd-auth-token",
    );
    expect(() => mobileAuthStorageKey("file:///tmp")).toThrow(
      "The Supabase URL is invalid.",
    );
    expect(() => mobileAuthStorageKey("http://.")).toThrow(
      "The Supabase URL is invalid.",
    );
  });

  it("restores a principal from secure storage without returning tokens", async () => {
    const store = memoryStore({
      [storageKey]: '{"persisted":true}',
    });
    const client = fakeClient({
      session: {
        user: {
          id: userId,
          user_metadata: {
            display_name: "Alex M",
            access_token: leakedToken,
          },
        },
        expires_at: Math.floor(now / 1000) + 60,
      },
    });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(JSON.stringify(snapshot).includes(leakedToken)).toBe(false);
    expect(client.refreshCalls).toBe(0);
    expect(store.removed).toEqual([]);
  });

  it("returns unauthenticated when secure storage is empty", async () => {
    const store = memoryStore();
    const client = fakeClient({ session: null });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
    });

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(client.sessionCalls).toBe(0);
    expect(store.removed).toEqual([]);
  });

  it("treats blank storage as absent without consulting the provider", async () => {
    const store = memoryStore({ [storageKey]: " \n  " });
    const client = fakeClient({ session: { user: { id: userId } } });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(client.sessionCalls).toBe(0);
  });

  it("does not expose unusable metadata and handles missing expiry", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({
      session: {
        user: { id: userId, user_metadata: { display_name: "" } },
      },
    });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId },
    });
  });

  it("clears an unparseable stored value", async () => {
    const store = memoryStore({
      [storageKey]: "{secret-refresh-token",
    });
    const client = fakeClient({ session: null });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(JSON.stringify(snapshot).includes("secret-refresh-token")).toBe(
      false,
    );
    expect(store.removed).toEqual([
      storageKey,
      `${storageKey}-code-verifier`,
      `${storageKey}-user`,
    ]);
    expect(client.sessionCalls).toBe(0);
  });

  it("clears storage when the stored value cannot be read as a session", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({
      session: null,
      sessionError: { status: 500, message: "secret-refresh-token" },
    });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(JSON.stringify(snapshot).includes("secret-refresh-token")).toBe(
      false,
    );
    expect(store.removed).toEqual([
      storageKey,
      `${storageKey}-code-verifier`,
      `${storageKey}-user`,
    ]);
  });

  it("refreshes an expired stored session", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({
      session: {
        user: { id: userId },
        expires_at: Math.floor(now / 1000) - 10,
      },
      refreshed: {
        user: {
          id: userId,
          user_metadata: { display_name: "Alex M" },
        },
        expires_at: Math.floor(now / 1000) + 3600,
      },
    });

    const snapshot = await refreshMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(client.refreshCalls).toBe(1);
  });

  it("clears a revoked refresh", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({
      session: null,
      refreshError: { status: 401, code: "refresh_token_not_found" },
    });

    const snapshot = await refreshMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({ state: "expired" });
    expect(store.removed).toEqual([
      storageKey,
      `${storageKey}-code-verifier`,
      `${storageKey}-user`,
    ]);
  });

  it("keeps the stored session in recovery when refresh cannot reach the provider", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({
      session: {
        user: { id: userId },
        expires_at: Math.floor(now / 1000) - 10,
      },
      refreshError: new TypeError("Failed to fetch person@example.com"),
    });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
      message: "Sign-in is unavailable right now.",
    });
    expect(JSON.stringify(snapshot).includes("person@example.com")).toBe(false);
    expect(store.removed).toEqual([]);
  });

  it("does not fall back to a session after a definitive refresh rejection", async () => {
    const store = memoryStore();
    const client = fakeClient({
      session: null,
      refreshError: { status: 400, code: "invalid_grant" },
    });

    const snapshot = await refreshMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({ state: "expired" });
    expect(client.sessionCalls).toBe(0);
  });

  it("expires when a refresh succeeds without a session", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({ session: null, refreshed: null });

    const snapshot = await refreshMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({ state: "expired" });
    expect(store.removed).toEqual([
      storageKey,
      `${storageKey}-code-verifier`,
      `${storageKey}-user`,
    ]);
  });

  it("signs out locally only after storage is cleared", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({
      session: { user: { id: userId } },
      signOutClears: true,
    });

    const snapshot = await signOutMobileAuthSession(
      { client, storage: store.storage, storageKey, now },
      "local",
    );

    expect(snapshot).toEqual({ state: "unauthenticated" });
    expect(client.scopes).toEqual(["local"]);
  });

  it("keeps a stored session when a rejected refresh did not remove it", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({
      session: {
        user: {
          id: userId,
          user_metadata: { display_name: "Alex M", access_token: leakedToken },
        },
        expires_at: Math.floor(now / 1000) + 3600,
      },
      refreshError: { status: 401, code: "refresh_token_already_used" },
    });

    const snapshot = await refreshMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(store.removed).toEqual([]);
    expect(JSON.stringify(snapshot).includes(leakedToken)).toBe(false);
  });

  it("stays in recovery when secure storage cannot be read", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    store.storage.getItem = async () => {
      throw new Error(`read failed ${leakedToken}`);
    };
    const client = fakeClient({ session: null });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toMatchObject({ state: "recovery" });
    expect(JSON.stringify(snapshot).includes(leakedToken)).toBe(false);
    expect(store.removed).toEqual([]);
    expect(client.sessionCalls).toBe(0);
  });

  it("stays in recovery when a corrupt session cannot be deleted", async () => {
    const store = memoryStore({ [storageKey]: "{secret-refresh-token" });
    store.storage.removeItem = async () => {
      throw new Error(`delete failed ${leakedToken}`);
    };
    const client = fakeClient({ session: null });

    const snapshot = await restoreMobileAuthSession({
      client,
      storage: store.storage,
      storageKey,
      now,
    });

    expect(snapshot).toMatchObject({ state: "recovery" });
    expect(JSON.stringify(snapshot).includes(leakedToken)).toBe(false);
    expect(JSON.stringify(snapshot).includes("secret-refresh-token")).toBe(
      false,
    );
  });

  it("does not claim sign-out succeeded while the stored session remains", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    store.storage.removeItem = async () => undefined;
    const client = fakeClient({
      session: {
        user: {
          id: userId,
          user_metadata: { access_token: leakedToken },
        },
      },
      signOutError: new TypeError("Failed to fetch"),
    });

    const snapshot = await signOutMobileAuthSession(
      { client, storage: store.storage, storageKey, now },
      "global",
    );

    expect(snapshot).toEqual({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
      message: "Sign-in is unavailable right now.",
    });
    expect(client.scopes).toEqual(["global"]);
    expect(JSON.stringify(snapshot).includes(leakedToken)).toBe(false);
  });

  it("adapts a Supabase client to the common session gateway", async () => {
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    const client = fakeClient({ session: { user: { id: userId } } });
    const gateway = mobileAuthSessionGatewayFromSupabase(
      client as never,
      store.storage,
      "http://127.0.0.1:54321",
    );

    expect(await gateway.readPersisted()).toMatchObject({
      kind: "principal",
      principal: { userId },
    });
    await gateway.revoke("local");
    expect(client.scopes).toEqual(["local"]);
  });

  it("requires the Expo Supabase URL before creating a live gateway", () => {
    const previous = process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    expect(() => createLiveMobileAuthSessionGateway()).toThrow(
      "EXPO_PUBLIC_SUPABASE_URL is required.",
    );
    if (previous === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it("restores through the configured live client", async () => {
    const previous = process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    const client = fakeClient({ session: { user: { id: userId } } });
    const store = memoryStore({ [storageKey]: '{"persisted":true}' });
    mockLiveMocks().client = client;
    mockLiveMocks().storage = store.storage;

    try {
      expect(await restoreLiveMobileAuthSession()).toEqual({
        state: "authenticated",
        principal: { userId },
      });
    } finally {
      if (previous === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
      }
    }
  });

  it("clears the signed-out user's offline snapshot after a live local logout", async () => {
    const previous = process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    const client = fakeClient({
      session: { user: { id: userId } },
      signOutClears: true,
    });
    mockLiveMocks().client = client;
    mockLiveMocks().storage = memoryStore({
      [storageKey]: '{"persisted":true}',
    }).storage;
    const snapshotStore = memoryStore();
    mockLiveMocks().snapshotStore = snapshotStore.storage;
    mockLiveMocks().offlineClearCalls.length = 0;

    try {
      expect(await signOutLiveMobileAuthSession()).toEqual({
        state: "unauthenticated",
      });
      expect(mockLiveMocks().offlineClearCalls[0]).toEqual([
        snapshotStore.storage,
        userId,
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
      }
    }
  });
});

function memoryStore(initial: Record<string, string> = {}): {
  storage: MobileAuthStorage;
  removed: string[];
} {
  const values = new Map(Object.entries(initial));
  const removed: string[] = [];
  return {
    removed,
    storage: {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async removeItem(key) {
        removed.push(key);
        values.delete(key);
      },
    },
  };
}

function fakeClient(input: {
  session: {
    user: { id: string; user_metadata?: unknown };
    expires_at?: number;
  } | null;
  sessionError?: unknown;
  refreshed?: {
    user: { id: string; user_metadata?: unknown };
    expires_at?: number;
  } | null;
  refreshError?: unknown;
  signOutError?: unknown;
  signOutClears?: boolean;
}): MobileAuthClient & {
  sessionCalls: number;
  refreshCalls: number;
  scopes: string[];
} {
  const calls = {
    sessionCalls: 0,
    refreshCalls: 0,
    scopes: [] as string[],
    auth: {
      async getSession() {
        calls.sessionCalls += 1;
        return {
          data: { session: input.session },
          error: input.sessionError ?? null,
        };
      },
      async refreshSession() {
        calls.refreshCalls += 1;
        if (input.refreshError !== undefined) {
          return { data: { session: null }, error: input.refreshError };
        }
        return {
          data: { session: input.refreshed ?? input.session },
          error: null,
        };
      },
      async signOut(options: { scope: "local" | "global" }) {
        calls.scopes.push(options.scope);
        if (input.signOutError !== undefined) {
          return { error: input.signOutError };
        }
        if (input.signOutClears) {
          input.session = null;
        }
        return { error: null };
      },
    },
  };

  return calls;
}
