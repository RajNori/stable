import * as SecureStore from "expo-secure-store";

import {
  createMobileSupabaseClient,
  getMobileSessionStorage,
  getMobileSupabaseClient,
  MOBILE_SESSION_PERSISTENCE,
  mobileSecureStoreOptions,
} from "./supabase-client";

declare const jest: {
  mock: (moduleName: string, factory: () => unknown) => void;
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string, options: unknown) => {
    mockClientCalls().push([url, key, options]);
    return { url, key, options };
  },
}));
jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "unlocked-device-only",
  getItemAsync: async (key: string) => mockSecureValues().get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSecureValues().set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockSecureValues().delete(key);
  },
}));

function mockClientCalls(): unknown[][] {
  const holder = globalThis as typeof globalThis & {
    __stableM5SupabaseClientCalls?: unknown[][];
  };
  holder.__stableM5SupabaseClientCalls ??= [];
  return holder.__stableM5SupabaseClientCalls;
}

function mockSecureValues(): Map<string, string> {
  const holder = globalThis as typeof globalThis & {
    __stableM5SecureValues?: Map<string, string>;
  };
  holder.__stableM5SecureValues ??= new Map();
  return holder.__stableM5SecureValues;
}

describe("mobile supabase client", () => {
  it("keeps refresh under the app lifecycle and uses device-only unlocked storage", () => {
    expect(MOBILE_SESSION_PERSISTENCE).toEqual({
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    });
    expect(mobileSecureStoreOptions().keychainAccessible).toBe(
      SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    );
  });

  it("requires both public Supabase values before constructing a client", () => {
    const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "local-publishable";
    expect(() => createMobileSupabaseClient()).toThrow(
      "EXPO_PUBLIC_SUPABASE_URL is required.",
    );

    process.env.EXPO_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(() => createMobileSupabaseClient()).toThrow(
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.",
    );

    restoreEnv(oldUrl, oldKey);
  });

  it("uses one configured client and its chunked device-only storage", async () => {
    const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "local-publishable";
    try {
      const first = getMobileSupabaseClient();
      expect(getMobileSupabaseClient()).toBe(first);
      const calls = mockClientCalls();
      expect(calls[0]?.slice(0, 2)).toEqual([
        "http://127.0.0.1:54321",
        "local-publishable",
      ]);
      const options = calls[0]?.[2] as {
        auth: {
          autoRefreshToken: boolean;
          persistSession: boolean;
          detectSessionInUrl: boolean;
          storage: unknown;
        };
      };
      expect(options.auth.autoRefreshToken).toBe(false);
      expect(options.auth.persistSession).toBe(true);
      expect(options.auth.detectSessionInUrl).toBe(false);
      expect(options.auth.storage).toBeTruthy();

      const storage = getMobileSessionStorage();
      await storage.setItem("session", "local-session");
      expect(await storage.getItem("session")).toBe("local-session");
      await storage.removeItem("session");
      expect(await storage.getItem("session")).toBeNull();
    } finally {
      restoreEnv(oldUrl, oldKey);
    }
  });
});

function restoreEnv(url: string | undefined, key: string | undefined): void {
  if (url === undefined) {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  } else {
    process.env.EXPO_PUBLIC_SUPABASE_URL = url;
  }
  if (key === undefined) {
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  }
}
