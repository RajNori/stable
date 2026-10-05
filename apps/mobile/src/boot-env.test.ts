import { ENV } from "@stable/contracts";

import { loadMobileBootEnv } from "./boot-env";

declare function require(moduleName: string): { default: unknown };

const publishableKey = "sb_publishable_test";

describe("mobile boot environment", () => {
  it("accepts a local loopback config", () => {
    const parsed = loadMobileBootEnv({
      [ENV.expoAppEnv]: "local",
      [ENV.expoSupabaseUrl]: "http://127.0.0.1:54321",
      [ENV.expoSupabasePublishableKey]: publishableKey,
    });

    expect(parsed.appEnv).toBe("local");
    expect(parsed.supabaseUrl).toBe("http://127.0.0.1:54321");
  });

  it("fails closed for a hosted project and a secret publishable key", () => {
    expect(() =>
      loadMobileBootEnv({
        [ENV.expoAppEnv]: "local",
        [ENV.expoSupabaseUrl]: "https://abcd.supabase.co",
        [ENV.expoSupabasePublishableKey]: publishableKey,
      }),
    ).toThrow(/supabase\.co/);

    expect(() =>
      loadMobileBootEnv({
        [ENV.expoAppEnv]: "local",
        [ENV.expoSupabaseUrl]: "http://127.0.0.1:54321",
        [ENV.expoSupabasePublishableKey]: "sb_secret_mobile",
      }),
    ).toThrow(/publishable key/);
  });

  it("loads the Expo shell only after boot validation", () => {
    process.env.EXPO_PUBLIC_APP_ENV = "local";
    process.env.EXPO_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey;

    const layout = require("../app/_layout");

    expect(typeof layout.default).toBe("function");
  });
});
