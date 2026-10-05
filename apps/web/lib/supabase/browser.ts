"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readPublicSupabaseConfig } from "../public-supabase-env";

export function createSupabaseBrowserClient(): SupabaseClient {
  const { url, publishableKey } = readPublicSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}
