import { principalFromSession } from "@stable/auth";
import type { CurrentClubContext } from "@stable/contracts";
import type { User } from "@supabase/supabase-js";

import { loadCurrentClubContext } from "./load-current-club-context";
import { getMobileSupabaseClient } from "./supabase-client";
import { createMobileClubContextReader } from "./supabase-reader";

function readDisplayName(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }

  const value = Object.getOwnPropertyDescriptor(
    metadata,
    "display_name",
  )?.value;
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

function sessionIdentityFromUser(user: User): {
  id: string;
  displayName?: string;
} {
  const displayName = readDisplayName(user.user_metadata);
  if (displayName === undefined) {
    return { id: user.id };
  }

  return { id: user.id, displayName };
}

export async function loadMobileCurrentClubContext(): Promise<CurrentClubContext> {
  const client = getMobileSupabaseClient();
  const reader = createMobileClubContextReader(client);
  const { data, error } = await client.auth.getSession();
  if (error !== null) {
    throw new Error("The session could not be read.");
  }

  const user = data.session?.user;
  const principal = principalFromSession(
    user === undefined ? null : sessionIdentityFromUser(user),
  );

  return loadCurrentClubContext({ principal, reader });
}
