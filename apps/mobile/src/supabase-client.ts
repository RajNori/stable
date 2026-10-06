import { ENV } from "@stable/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

import {
  createChunkedSessionStorage,
  type ChunkedSessionStorage,
} from "./secure-session-store";

/**
 * Unlocked-device keychain access, not synced to another device, and no
 * biometric prompt. Background refresh is stopped while the app is inactive,
 * so the session does not need to be readable on the lock screen.
 */
export const MOBILE_SESSION_PERSISTENCE = {
  autoRefreshToken: false,
  persistSession: true,
  detectSessionInUrl: false,
} as const;

export function mobileSecureStoreOptions(): {
  readonly keychainAccessible: SecureStore.KeychainAccessibilityConstant;
} {
  return {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
}

function secureStore(): ChunkedSessionStorage {
  const options = mobileSecureStoreOptions();
  return createChunkedSessionStorage({
    getItemAsync: (key) => SecureStore.getItemAsync(key, options),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
  });
}

function requiredPublicEnv(
  name: typeof ENV.expoSupabaseUrl | typeof ENV.expoSupabasePublishableKey,
): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

let sessionStorage: ChunkedSessionStorage | undefined;
let mobileSupabaseClient: SupabaseClient | undefined;

export function getMobileSessionStorage(): ChunkedSessionStorage {
  if (sessionStorage === undefined) {
    sessionStorage = secureStore();
  }

  return sessionStorage;
}

export function createMobileSupabaseClient(): SupabaseClient {
  return createClient(
    requiredPublicEnv(ENV.expoSupabaseUrl),
    requiredPublicEnv(ENV.expoSupabasePublishableKey),
    {
      auth: {
        storage: getMobileSessionStorage(),
        autoRefreshToken: MOBILE_SESSION_PERSISTENCE.autoRefreshToken,
        persistSession: MOBILE_SESSION_PERSISTENCE.persistSession,
        detectSessionInUrl: MOBILE_SESSION_PERSISTENCE.detectSessionInUrl,
      },
    },
  );
}

export function getMobileSupabaseClient(): SupabaseClient {
  if (mobileSupabaseClient === undefined) {
    mobileSupabaseClient = createMobileSupabaseClient();
  }

  return mobileSupabaseClient;
}
