import { ENV } from "@stable/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const secureStoreAdapter = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};

function requiredPublicEnv(
  name: typeof ENV.expoSupabaseUrl | typeof ENV.expoSupabasePublishableKey,
): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function createMobileSupabaseClient(): SupabaseClient {
  return createClient(
    requiredPublicEnv(ENV.expoSupabaseUrl),
    requiredPublicEnv(ENV.expoSupabasePublishableKey),
    {
      auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    },
  );
}

let mobileSupabaseClient: SupabaseClient | undefined;

export function getMobileSupabaseClient(): SupabaseClient {
  if (mobileSupabaseClient === undefined) {
    mobileSupabaseClient = createMobileSupabaseClient();
  }

  return mobileSupabaseClient;
}
