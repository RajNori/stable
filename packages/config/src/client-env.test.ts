import { ApplicationError, ENV } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  mobileClientEnvSchema,
  parseMobileClientEnv,
  parseWebClientEnv,
  readMobileBootEnv,
  readWebBootEnv,
  webClientEnvSchema,
} from "./index.js";

const publishableKey = "sb_publishable_test";

function webEnv(url: string, appEnv = "local"): Record<string, string> {
  return {
    [ENV.nextAppEnv]: appEnv,
    [ENV.nextSupabaseUrl]: url,
    [ENV.nextSupabasePublishableKey]: publishableKey,
  };
}

function mobileEnv(url: string, appEnv = "local"): Record<string, string> {
  return {
    [ENV.expoAppEnv]: appEnv,
    [ENV.expoSupabaseUrl]: url,
    [ENV.expoSupabasePublishableKey]: publishableKey,
  };
}

function expectValidationFailure(run: () => void, pattern: RegExp): void {
  try {
    run();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApplicationError);
    if (!(error instanceof ApplicationError)) {
      return;
    }
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toMatch(pattern);
    return;
  }

  throw new Error("expected client environment validation to fail");
}

describe("client environment schemas", () => {
  it("does not include the server secret key", () => {
    expect(ENV.supabaseSecretKey in webClientEnvSchema.shape).toBe(false);
    expect(ENV.supabaseSecretKey in mobileClientEnvSchema.shape).toBe(false);
    expect(Object.keys(webClientEnvSchema.shape)).not.toContain(
      ENV.supabaseSecretKey,
    );
    expect(Object.keys(mobileClientEnvSchema.shape)).not.toContain(
      ENV.supabaseSecretKey,
    );
  });
});

describe("web client environment", () => {
  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
    "http://LOCALHOST:54321",
  ])("local accepts loopback %s", (url) => {
    const parsed = parseWebClientEnv(webEnv(url));

    expect(parsed).toEqual({
      appEnv: "local",
      supabaseUrl: url,
      supabasePublishableKey: publishableKey,
    });
    expect(parsed).not.toHaveProperty("sentryDsn");
    expect(parsed).not.toHaveProperty("posthogKey");
    expect(parsed).not.toHaveProperty("posthogHost");
  });

  it.each([
    "http://192.168.1.20:54321",
    "http://10.0.2.2:54321",
    "http://10.1.2.3:54321",
    "http://172.16.5.5:54321",
    "https://example.com",
    "https://abcd.supabase.co",
    "https://project.supabase.co/rest/v1",
  ])("local rejects %s", (url) => {
    expectValidationFailure(
      () => parseWebClientEnv(webEnv(url)),
      /loopback|supabase\.co/i,
    );
  });

  it.each(["staging", "production"] as const)(
    "%s rejects loopback and private LAN hosts",
    (appEnv) => {
      for (const url of [
        "http://localhost:54321",
        "http://127.0.0.1:54321",
        "http://[::1]:54321",
        "http://127.0.0.2:54321",
        "http://192.168.1.20:54321",
        "http://10.0.2.2:54321",
        "http://172.16.0.1:54321",
        "http://172.31.255.255:54321",
      ]) {
        expectValidationFailure(
          () => parseWebClientEnv(webEnv(url, appEnv)),
          /loopback|private/i,
        );
      }

      expect(
        parseWebClientEnv(webEnv("https://staging.invalid", appEnv)),
      ).toMatchObject({
        appEnv,
        supabaseUrl: "https://staging.invalid",
      });
      expect(
        parseWebClientEnv(webEnv("https://abcd.supabase.co", appEnv))
          .supabaseUrl,
      ).toBe("https://abcd.supabase.co");
    },
  );

  it("fails closed when app env, url, or publishable key is missing or blank", () => {
    expectValidationFailure(() => parseWebClientEnv({}), /NEXT_PUBLIC_APP_ENV/);
    expectValidationFailure(
      () =>
        parseWebClientEnv({
          [ENV.nextSupabaseUrl]: "http://127.0.0.1:54321",
          [ENV.nextSupabasePublishableKey]: publishableKey,
        }),
      /NEXT_PUBLIC_APP_ENV/,
    );
    expectValidationFailure(
      () =>
        parseWebClientEnv({
          [ENV.nextAppEnv]: "local",
          [ENV.nextSupabasePublishableKey]: publishableKey,
        }),
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    expectValidationFailure(
      () =>
        parseWebClientEnv({
          [ENV.nextAppEnv]: "local",
          [ENV.nextSupabaseUrl]: "http://127.0.0.1:54321",
        }),
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
    expectValidationFailure(
      () => parseWebClientEnv(webEnv("   ")),
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    expectValidationFailure(
      () =>
        parseWebClientEnv({
          ...webEnv("http://127.0.0.1:54321"),
          [ENV.nextSupabasePublishableKey]: "  ",
        }),
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
    expectValidationFailure(
      () =>
        parseWebClientEnv({
          ...webEnv("http://127.0.0.1:54321"),
          [ENV.nextAppEnv]: "dev",
        }),
      /NEXT_PUBLIC_APP_ENV/,
    );
  });

  it("rejects a secret key and does not echo the secret", () => {
    const secret = "sb_secret_web_client";

    expectValidationFailure(
      () =>
        parseWebClientEnv({
          ...webEnv("http://127.0.0.1:54321"),
          [ENV.supabaseSecretKey]: secret,
        }),
      /SUPABASE_SECRET_KEY/,
    );

    try {
      parseWebClientEnv({
        ...webEnv("http://127.0.0.1:54321"),
        [ENV.supabaseSecretKey]: secret,
      });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApplicationError);
      if (error instanceof ApplicationError) {
        expect(error.message).not.toContain(secret);
      }
    }

    expectValidationFailure(
      () =>
        parseWebClientEnv({
          ...webEnv("http://127.0.0.1:54321"),
          [ENV.supabaseSecretKey]: "",
        }),
      /SUPABASE_SECRET_KEY/,
    );
  });

  it("boots when public Sentry and PostHog values are absent or blank", () => {
    const parsed = parseWebClientEnv({
      ...webEnv("http://127.0.0.1:54321"),
      NEXT_PUBLIC_SENTRY_DSN: "  ",
      NEXT_PUBLIC_POSTHOG_KEY: "",
      NEXT_PUBLIC_POSTHOG_HOST: " ",
    });

    expect(parsed).not.toHaveProperty("sentryDsn");
    expect(parsed).not.toHaveProperty("posthogKey");
    expect(parsed).not.toHaveProperty("posthogHost");
  });

  it("keeps optional public Sentry and PostHog values when they are present", () => {
    const parsed = parseWebClientEnv({
      ...webEnv("http://127.0.0.1:54321"),
      NEXT_PUBLIC_SENTRY_DSN: " https://example.invalid/1 ",
      NEXT_PUBLIC_POSTHOG_KEY: " phc_test ",
      NEXT_PUBLIC_POSTHOG_HOST: " https://us.i.posthog.com ",
    });

    expect(parsed.sentryDsn).toBe("https://example.invalid/1");
    expect(parsed.posthogKey).toBe("phc_test");
    expect(parsed.posthogHost).toBe("https://us.i.posthog.com");
  });

  it("rejects a non-http url", () => {
    expectValidationFailure(
      () => parseWebClientEnv(webEnv("ftp://127.0.0.1/db")),
      /http/i,
    );
    expectValidationFailure(
      () => parseWebClientEnv(webEnv("127.0.0.1:54321")),
      /URL/i,
    );
  });
});

describe("mobile client environment", () => {
  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
    "http://10.0.2.2:54321",
    "http://10.1.2.3:54321",
    "http://10.255.255.255:54321",
    "http://192.168.0.1:54321",
    "http://192.168.1.20:54321",
    "http://172.16.0.1:54321",
    "http://172.31.255.255:54321",
  ])("local accepts %s", (url) => {
    expect(parseMobileClientEnv(mobileEnv(url))).toMatchObject({
      appEnv: "local",
      supabaseUrl: url,
      supabasePublishableKey: publishableKey,
    });
  });

  it.each([
    "https://abcd.supabase.co",
    "https://example.com",
    "http://8.8.8.8:54321",
    "http://11.0.0.1:54321",
    "http://172.15.255.255:54321",
    "http://172.32.0.1:54321",
    "http://192.167.1.1:54321",
    "http://192.169.1.1:54321",
    "http://127.0.0.2:54321",
  ])("local rejects %s", (url) => {
    expectValidationFailure(
      () => parseMobileClientEnv(mobileEnv(url)),
      /loopback|LAN|supabase\.co|local/i,
    );
  });

  it.each(["staging", "production"] as const)(
    "%s rejects loopback and private LAN hosts",
    (appEnv) => {
      for (const url of [
        "http://127.0.0.1:54321",
        "http://10.0.2.2:54321",
        "http://192.168.1.20:54321",
        "http://172.16.0.1:54321",
      ]) {
        expectValidationFailure(
          () => parseMobileClientEnv(mobileEnv(url, appEnv)),
          /loopback|private/i,
        );
      }

      expect(
        parseMobileClientEnv(mobileEnv("https://staging.invalid", appEnv))
          .appEnv,
      ).toBe(appEnv);
    },
  );

  it("fails closed when required public values are missing", () => {
    expectValidationFailure(
      () => parseMobileClientEnv({}),
      /EXPO_PUBLIC_APP_ENV/,
    );
    expectValidationFailure(
      () =>
        parseMobileClientEnv({
          [ENV.expoAppEnv]: "local",
          [ENV.expoSupabasePublishableKey]: publishableKey,
        }),
      /EXPO_PUBLIC_SUPABASE_URL/,
    );
    expectValidationFailure(
      () =>
        parseMobileClientEnv({
          [ENV.expoAppEnv]: "local",
          [ENV.expoSupabaseUrl]: "http://127.0.0.1:54321",
        }),
      /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("rejects a secret key on the mobile client record", () => {
    const secret = "sb_secret_mobile_client";

    try {
      parseMobileClientEnv({
        ...mobileEnv("http://10.0.2.2:54321"),
        [ENV.supabaseSecretKey]: secret,
      });
      throw new Error("expected the secret key to be rejected");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApplicationError);
      if (error instanceof ApplicationError) {
        expect(error.code).toBe("VALIDATION_FAILED");
        expect(error.message).toMatch(/SUPABASE_SECRET_KEY/);
        expect(error.message).not.toContain(secret);
      }
    }
  });

  it("does not require public Sentry or PostHog values", () => {
    const absent = parseMobileClientEnv(mobileEnv("http://10.0.2.2:54321"));
    expect(absent).not.toHaveProperty("sentryDsn");
    expect(absent).not.toHaveProperty("posthogKey");
    expect(absent).not.toHaveProperty("posthogHost");

    const present = parseMobileClientEnv({
      ...mobileEnv("http://10.0.2.2:54321"),
      EXPO_PUBLIC_SENTRY_DSN: "https://example.invalid/2",
      EXPO_PUBLIC_POSTHOG_KEY: "phc_mobile",
      EXPO_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
    });
    expect(present.sentryDsn).toBe("https://example.invalid/2");
    expect(present.posthogKey).toBe("phc_mobile");
    expect(present.posthogHost).toBe("https://us.i.posthog.com");
  });
});

describe("boot environment", () => {
  it("accepts a valid local web config and omits a server secret", () => {
    const parsed = readWebBootEnv({
      ...webEnv("http://127.0.0.1:54321"),
      [ENV.supabaseSecretKey]: "server-only-secret",
      UNRELATED: "ignored",
    });

    expect(parsed).toEqual({
      appEnv: "local",
      supabaseUrl: "http://127.0.0.1:54321",
      supabasePublishableKey: publishableKey,
    });
    expect(JSON.stringify(parsed)).not.toContain("server-only-secret");
  });

  it("accepts a valid local mobile config and omits a server secret", () => {
    const parsed = readMobileBootEnv({
      ...mobileEnv("http://10.0.2.2:54321"),
      [ENV.supabaseSecretKey]: "server-only-secret",
    });

    expect(parsed.supabaseUrl).toBe("http://10.0.2.2:54321");
    expect(JSON.stringify(parsed)).not.toContain("server-only-secret");
  });

  it("fails closed when a public value is the secret or a secret key", () => {
    const secret = "sb_secret_boot";

    expectValidationFailure(
      () =>
        readWebBootEnv({
          ...webEnv("http://127.0.0.1:54321"),
          [ENV.nextSupabasePublishableKey]: secret,
          [ENV.supabaseSecretKey]: secret,
        }),
      /public client value/,
    );
    expectValidationFailure(
      () =>
        readMobileBootEnv({
          ...mobileEnv("http://127.0.0.1:54321"),
          [ENV.expoSupabasePublishableKey]: "sb_secret_mobile",
        }),
      /publishable key/,
    );
  });

  it("keeps staging and production host rules at boot", () => {
    expectValidationFailure(
      () => readWebBootEnv(webEnv("http://192.168.1.20:54321", "staging")),
      /loopback|private/i,
    );
    expectValidationFailure(
      () => readMobileBootEnv(mobileEnv("https://abcd.supabase.co")),
      /supabase\.co/,
    );
    expect(
      readWebBootEnv(webEnv("https://staging.invalid", "production")).appEnv,
    ).toBe("production");
  });
});
