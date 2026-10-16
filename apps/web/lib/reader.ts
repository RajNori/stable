import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClubContextReader } from "@stable/contracts";
import { createSupabaseClubContextReader } from "@stable/current-club-context";

/** Typed web boundary for the domain-owned Supabase club-context reader. */
export function createClubContextReader(
  client: SupabaseClient,
): ClubContextReader {
  return createSupabaseClubContextReader(client);
}
