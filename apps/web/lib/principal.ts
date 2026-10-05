import { principalFromSession } from "@stable/auth";
import type { Principal } from "@stable/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

function displayNameFromMetadata(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }

  if (!("display_name" in metadata)) {
    return undefined;
  }

  const value: unknown = metadata.display_name;
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

export async function principalFromSupabase(
  supabase: SupabaseClient,
): Promise<Principal | null> {
  const { data } = await supabase.auth.getUser();
  if (data.user === null) {
    return null;
  }

  const displayName = displayNameFromMetadata(data.user.user_metadata);
  if (displayName === undefined) {
    return principalFromSession({ id: data.user.id });
  }

  return principalFromSession({ id: data.user.id, displayName });
}
