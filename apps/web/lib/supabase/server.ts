import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readPublicSupabaseConfig } from "../public-supabase-env";

type PendingCookie = {
  name: string;
  value: string;
  options: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = readPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always persist refreshed auth cookies.
          // Reading the current session still uses the request cookies.
        }
      },
    },
  });
}

/**
 * Route Handlers must attach session cookies to the redirect response.
 * `cookies().set` alone does not travel with `NextResponse.redirect`.
 */
export async function createSupabaseRedirectClient(): Promise<{
  client: SupabaseClient;
  applyCookies: (response: NextResponse) => NextResponse;
}> {
  const { url, publishableKey } = readPublicSupabaseConfig();
  const cookieStore = await cookies();
  const pending: PendingCookie[] = [];

  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pending.length = 0;
        for (const cookie of cookiesToSet) {
          pending.push(cookie);
          cookieStore.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  return {
    client,
    applyCookies(response) {
      for (const cookie of pending) {
        if (cookie.options === undefined) {
          response.cookies.set(cookie.name, cookie.value);
        } else {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      }
      return response;
    },
  };
}
