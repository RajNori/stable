import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Browser, BrowserContext } from "@playwright/test";

import type { HostedEnv } from "./hosted-env";

type StoredCookie = {
  name: string;
  value: string;
  options: { httpOnly?: boolean; sameSite?: string | boolean };
};

function sameSite(
  value: string | boolean | undefined,
): "Lax" | "Strict" | "None" {
  if (value === "strict" || value === "Strict") return "Strict";
  if (value === "none" || value === "None") return "None";
  return "Lax";
}

/**
 * Mints a one-time magic-link proof through Auth Admin (no email is sent),
 * exchanges it with the publishable key, and applies the resulting SSR
 * cookies to the hosted Preview origin. Only fixed error text is thrown.
 */
export async function applyHostedSession(
  context: BrowserContext,
  env: HostedEnv,
  email: string,
): Promise<void> {
  const admin = createClient(env.supabaseUrl, env.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = generated.data.properties?.hashed_token;
  if (generated.error !== null || tokenHash === undefined) {
    throw new Error("Staging Auth Admin did not return a one-time proof.");
  }

  const stored: StoredCookie[] = [];
  const supabase = createServerClient(env.supabaseUrl, env.publishableKey, {
    cookies: {
      getAll: () => stored.map(({ name, value }) => ({ name, value })),
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
  const verified = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verified.error !== null || stored.length === 0) {
    throw new Error("Staging Auth did not establish a session.");
  }

  await context.addCookies(
    stored.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: env.webUrl,
      httpOnly: cookie.options.httpOnly === true,
      secure: true,
      sameSite: sameSite(cookie.options.sameSite),
    })),
  );
}

/**
 * Creates a browser context for one synthetic role. With Vercel Deployment
 * Protection on Previews, the automation bypass is exchanged for a cookie on
 * the Preview origin only, so it never reaches Supabase requests.
 */
export async function hostedRole(
  browser: Browser,
  env: HostedEnv,
  email: string,
) {
  const context = await browser.newContext({ baseURL: env.webUrl });
  if (env.vercelBypass !== undefined) {
    const page = await context.newPage();
    const url = new URL("/", env.webUrl);
    url.searchParams.set("x-vercel-protection-bypass", env.vercelBypass);
    url.searchParams.set("x-vercel-set-bypass-cookie", "true");
    await page.goto(url.toString());
    await page.close();
  }
  await applyHostedSession(context, env, email);
  const page = await context.newPage();
  return { context, page };
}
