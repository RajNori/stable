import type { ClubContextReader } from "@stable/contracts";
import { createSupabaseClubContextReader } from "@stable/current-club-context";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createMobileClubContextReader(
  client: SupabaseClient,
): ClubContextReader {
  return createSupabaseClubContextReader(client);
}
