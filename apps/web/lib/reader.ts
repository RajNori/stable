import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClubContextReader } from "@stable/contracts";
import { createSupabaseClubContextReader } from "@stable/current-club-context";

/**
 * Typed Supabase adapter for club context.
 * The domain workstream owns this export. This file stays on the web branch
 * so the import is ready when that export lands.
 */
export function createClubContextReader(
  client: SupabaseClient,
): ClubContextReader {
  return createSupabaseClubContextReader(client);
}
