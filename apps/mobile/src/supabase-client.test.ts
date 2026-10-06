import * as SecureStore from "expo-secure-store";

import {
  MOBILE_SESSION_PERSISTENCE,
  mobileSecureStoreOptions,
} from "./supabase-client";

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
});
