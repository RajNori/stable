import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

const LOCAL_PASSWORD = "local-dev-password";

type StoredCookie = {
  name: string;
  value: string;
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string | boolean;
    path?: string;
  };
};

function requiredPublicValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for the local auth browser test.`);
  }
  if (value.startsWith("sb_secret_")) {
    throw new Error(`${name} must be the local publishable key.`);
  }
  return value;
}

function sameSite(
  value: string | boolean | undefined,
): "Lax" | "Strict" | "None" {
  if (value === "strict" || value === "Strict") {
    return "Strict";
  }
  if (value === "none" || value === "None") {
    return "None";
  }
  return "Lax";
}

/**
 * Signs in through the local Auth API with the publishable key and applies
 * the same cookies the Next.js server client will read.
 */
export async function applyLocalSession(
  context: BrowserContext,
  email: string,
): Promise<void> {
  const url = requiredPublicValue("SUPABASE_URL");
  const publishableKey = requiredPublicValue("SUPABASE_PUBLISHABLE_KEY");
  const stored: StoredCookie[] = [];
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return stored.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        stored.length = 0;
        for (const cookie of cookiesToSet) {
          stored.push({
            name: cookie.name,
            value: cookie.value,
            options: cookie.options,
          });
        }
      },
    },
  });

  const signedIn = await supabase.auth.signInWithPassword({
    email,
    password: LOCAL_PASSWORD,
  });
  if (signedIn.error !== null) {
    throw new Error("Local auth sign-in failed.");
  }
  if (stored.length === 0) {
    throw new Error("Local auth sign-in did not set a session cookie.");
  }

  await context.addCookies(
    stored.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: "http://127.0.0.1:3000",
      httpOnly: cookie.options.httpOnly === true,
      secure: false,
      sameSite: sameSite(cookie.options.sameSite),
    })),
  );
}
