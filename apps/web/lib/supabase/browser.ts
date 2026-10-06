"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  readPublicSupabaseConfig,
  type PublicSupabaseConfig,
} from "../public-supabase-env";

export function createSupabaseBrowserClient(
  config: PublicSupabaseConfig = readPublicSupabaseConfig(),
): SupabaseClient {
  return createBrowserClient(config.url, config.publishableKey);
}
