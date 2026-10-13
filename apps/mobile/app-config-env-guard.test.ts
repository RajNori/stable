import { assertNoSupabaseSecretInExpoPublicEnv } from "./app.config";

describe("Expo public environment pre-bundle guard", () => {
  it("rejects modern Supabase secret keys from every public Expo variable", () => {
    expect(() =>
      assertNoSupabaseSecretInExpoPublicEnv({
        EXPO_PUBLIC_POSTHOG_KEY: "sb_secret_test-only",
      }),
    ).toThrow("public Expo variables (EXPO_PUBLIC_POSTHOG_KEY)");
  });

  it("rejects legacy service-role JWTs without including values in errors", () => {
    const secret = "header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature";
    let message = "";
    try {
      assertNoSupabaseSecretInExpoPublicEnv({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("privileged credentials are not allowed");
    expect(message).not.toContain(secret);
  });

  it("rejects a public value that equals the separately supplied project secret", () => {
    expect(() =>
      assertNoSupabaseSecretInExpoPublicEnv({
        EXPO_PUBLIC_OTHER: "same-secret-value",
        SUPABASE_SECRET_KEY: "same-secret-value",
      }),
    ).toThrow("public Expo variables (EXPO_PUBLIC_OTHER)");
  });

  it("rejects values copied from legacy server-only Supabase variables", () => {
    expect(() =>
      assertNoSupabaseSecretInExpoPublicEnv({
        EXPO_PUBLIC_OTHER: "opaque-server-key",
        SUPABASE_SERVICE_ROLE_KEY: "opaque-server-key",
      }),
    ).toThrow("public Expo variables (EXPO_PUBLIC_OTHER)");
  });

  it("rejects public variable names that imply privileged credentials", () => {
    expect(() =>
      assertNoSupabaseSecretInExpoPublicEnv({
        EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "opaque-value",
      }),
    ).toThrow("public Expo variables (EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)");
  });

  it("allows publishable keys and public telemetry destinations", () => {
    expect(() =>
      assertNoSupabaseSecretInExpoPublicEnv({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
        EXPO_PUBLIC_SENTRY_DSN: "https://public@example.invalid/1",
      }),
    ).not.toThrow();
  });
});
