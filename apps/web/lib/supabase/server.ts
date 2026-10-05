import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readPublicSupabaseConfig } from "../public-supabase-env";

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
