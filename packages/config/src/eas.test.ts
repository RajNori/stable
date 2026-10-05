import { ApplicationError, ENV } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import easFile from "../../../eas.json" with { type: "json" };

import { assertEasConfig } from "./index.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEasFile(): unknown {
  return JSON.parse(JSON.stringify(easFile)) as unknown;
}

function profileEnv(
  config: unknown,
  name: "development" | "preview" | "production",
): Record<string, unknown> {
  if (!isRecord(config) || !isRecord(config.build)) {
    throw new Error("eas.json is missing build profiles");
  }
  const profile = config.build[name];
  if (!isRecord(profile) || !isRecord(profile.env)) {
    throw new Error(`eas.json ${name} profile is missing env`);
  }
  return profile.env;
}

function easConfig(profiles: {
  development?: unknown;
  preview?: unknown;
  production?: unknown;
  submit?: unknown;
}): unknown {
  const config: Record<string, unknown> = {
    build: {
      development: profiles.development ?? {
        env: { [ENV.expoAppEnv]: "local" },
      },
      preview: profiles.preview ?? {
        env: {
          [ENV.expoAppEnv]: "staging",
          [ENV.expoSupabaseUrl]: "https://staging.invalid",
        },
      },
      production: profiles.production ?? {
        env: { [ENV.expoAppEnv]: "production" },
      },
    },
  };
  if ("submit" in profiles) {
    config.submit = profiles.submit;
  }
  return config;
}

function expectEasFailure(config: unknown, pattern: RegExp): void {
  try {
    assertEasConfig(config);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApplicationError);
    if (!(error instanceof ApplicationError)) {
      return;
    }
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toMatch(pattern);
    return;
  }

  throw new Error("expected EAS profile validation to fail");
}

describe("eas.json", () => {
  it("parses the repo file and checks Milestone 0 profiles", () => {
    const config = readEasFile();
    expect(isRecord(config)).toBe(true);
    if (!isRecord(config)) {
      return;
    }

    expect(config).not.toHaveProperty("submit");
    expect(JSON.stringify(config)).not.toContain("supabase.co");
    expect(JSON.stringify(config)).not.toMatch(
      /192\.168\.|10\.0\.2\.2|172\.16\./,
    );

    const development = profileEnv(config, "development");
    const preview = profileEnv(config, "preview");
    const production = profileEnv(config, "production");

    expect(development[ENV.expoAppEnv]).toBe("local");
    expect(development[ENV.expoSupabaseUrl]).toBeUndefined();
    expect(preview[ENV.expoAppEnv]).toBe("staging");
    expect(preview[ENV.expoSupabaseUrl]).toBe("https://staging.invalid");
    expect(production[ENV.expoAppEnv]).toBe("production");
    expect(production).not.toHaveProperty("submit");

    if (!isRecord(config.build) || !isRecord(config.build.production)) {
      throw new Error("eas.json is missing the production profile");
    }
    expect(config.build.production).not.toHaveProperty("submit");

    expect(() => assertEasConfig(config)).not.toThrow();
  });

  it("allows development to use the mobile local allowlist and rejects a public host", () => {
    expect(() =>
      assertEasConfig(
        easConfig({
          development: {
            env: {
              [ENV.expoAppEnv]: "local",
              [ENV.expoSupabaseUrl]: "http://10.0.2.2:54321",
            },
          },
        }),
      ),
    ).not.toThrow();

    expect(() =>
      assertEasConfig(
        easConfig({
          development: {
            env: {
              [ENV.expoAppEnv]: "local",
              [ENV.expoSupabaseUrl]: "http://192.168.1.20:54321",
            },
          },
        }),
      ),
    ).not.toThrow();

    expectEasFailure(
      easConfig({
        development: {
          env: {
            [ENV.expoAppEnv]: "local",
            [ENV.expoSupabaseUrl]: "https://abcd.supabase.co",
          },
        },
      }),
      /supabase\.co|local/i,
    );
  });

  it("requires preview to be staging and not a laptop, loopback, or LAN url", () => {
    expect(() =>
      assertEasConfig(
        easConfig({
          preview: {
            env: { [ENV.expoAppEnv]: "staging" },
          },
        }),
      ),
    ).not.toThrow();

    expect(() =>
      assertEasConfig(
        easConfig({
          preview: {
            env: {
              [ENV.expoAppEnv]: "staging",
              [ENV.expoSupabaseUrl]: "https://abcd.supabase.co",
            },
          },
        }),
      ),
    ).not.toThrow();

    for (const url of [
      "http://127.0.0.1:54321",
      "http://localhost:54321",
      "http://10.0.2.2:54321",
      "http://192.168.1.20:54321",
      "http://172.16.0.1:54321",
    ]) {
      expectEasFailure(
        easConfig({
          preview: {
            env: {
              [ENV.expoAppEnv]: "staging",
              [ENV.expoSupabaseUrl]: url,
            },
          },
        }),
        /loopback|private/i,
      );
    }

    expectEasFailure(
      easConfig({
        preview: {
          env: {
            [ENV.expoAppEnv]: "production",
            [ENV.expoSupabaseUrl]: "https://staging.invalid",
          },
        },
      }),
      /staging/,
    );

    expectEasFailure(
      easConfig({
        preview: {
          env: { [ENV.expoAppEnv]: "local" },
        },
      }),
      /staging/,
    );
  });

  it("requires production to be production and rejects a submit hook", () => {
    expect(() => assertEasConfig(easConfig({}))).not.toThrow();

    expectEasFailure(
      easConfig({
        production: {
          env: { [ENV.expoAppEnv]: "staging" },
        },
      }),
      /production/,
    );

    expectEasFailure(
      easConfig({
        production: {
          env: {
            [ENV.expoAppEnv]: "production",
            [ENV.expoSupabaseUrl]: "http://127.0.0.1:54321",
          },
        },
      }),
      /loopback|private/i,
    );

    expectEasFailure(
      easConfig({
        production: {
          env: { [ENV.expoAppEnv]: "production" },
          submit: { production: {} },
        },
      }),
      /submit/i,
    );

    expectEasFailure(easConfig({ submit: { production: {} } }), /submit/i);
  });

  it("fails closed when the file or a profile is not usable", () => {
    expectEasFailure(null, /eas\.json/i);
    expectEasFailure(1, /eas\.json/i);
    expectEasFailure([], /eas\.json/i);
    expectEasFailure({}, /build/i);
    expectEasFailure(
      { build: { preview: {}, production: {} } },
      /development/i,
    );
    expectEasFailure(easConfig({ development: {} }), /EXPO_PUBLIC_APP_ENV/);
    expectEasFailure(easConfig({ development: { env: [] } }), /object/i);
    expectEasFailure(
      easConfig({
        development: { env: { [ENV.expoAppEnv]: "   " } },
      }),
      /EXPO_PUBLIC_APP_ENV/,
    );
    expectEasFailure(
      easConfig({
        development: { env: { [ENV.expoAppEnv]: "local", EXTRA: 1 } },
      }),
      /string/i,
    );
    expect(() =>
      assertEasConfig(
        easConfig({
          preview: {
            env: {
              [ENV.expoAppEnv]: "staging",
              [ENV.expoSupabaseUrl]: "   ",
            },
          },
        }),
      ),
    ).not.toThrow();
  });
});
