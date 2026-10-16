import type { ClubContextPresentation } from "./club-context-presentation";
import {
  loadClubContext,
  presentClubContextFailure,
} from "./load-club-context";
import { principalFromSupabase } from "./principal";
import { createClubContextReader } from "./reader";
import { createSupabaseServerClient } from "./supabase/server";

export async function loadLiveClubContext(): Promise<ClubContextPresentation> {
  try {
    const supabase = await createSupabaseServerClient();
    const principal = await principalFromSupabase(supabase);
    const reader = await createClubContextReader(supabase);
    return await loadClubContext({ principal, reader });
  } catch (error: unknown) {
    return presentClubContextFailure(error);
  }
}
