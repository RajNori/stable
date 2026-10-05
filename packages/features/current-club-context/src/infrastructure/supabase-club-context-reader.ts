import {
  clubContextReadResultSchema,
  type ClubContextReadResult,
  type ClubContextReader,
} from "@stable/contracts";
import type { Database } from "@stable/database-types";
import type { SupabaseClient } from "@supabase/supabase-js";

const READ_FAILURE_MESSAGE = "Club context could not be read.";
const SIGNED_IN_DISPLAY_NAME = "Signed in";

/**
 * Reads club context through the caller's Supabase client.
 * Active memberships are selected with the club embedded, plus the caller's
 * profile display name. RLS returns no profile or membership rows when the
 * user has no active membership; display name then comes from auth metadata.
 * This function does not accept or read a secret key.
 */
export function createSupabaseClubContextReader(
  client: unknown,
): ClubContextReader {
  // Accept unknown so app packages are not coupled to this package's
  // SupabaseClient identity. The cast stays inside the adapter.
  const db = client as SupabaseClient<Database>;
  return {
    async read(userId: string): Promise<ClubContextReadResult> {
      const membershipResult = await db
        .from("club_memberships")
        .select(
          "club_id, role, active, clubs(id, name, slug, timezone, theme_key)",
        )
        .eq("user_id", userId)
        .eq("active", true);

      if (membershipResult.error !== null) {
        readFailure();
      }

      const profileResult = await db
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileResult.error !== null) {
        readFailure();
      }

      if (!Array.isArray(membershipResult.data)) {
        readFailure();
      }

      if (membershipResult.data.length === 0) {
        return parseResult(await readOutsiderDisplayName(db), []);
      }

      const displayName = readProfileDisplayName(profileResult.data);
      if (displayName === undefined) {
        readFailure();
      }

      return parseResult(displayName, mapMemberships(membershipResult.data));
    },
  };
}

function readFailure(): never {
  throw new Error(READ_FAILURE_MESSAGE);
}

function parseResult(
  displayName: string,
  memberships: unknown,
): ClubContextReadResult {
  const parsed = clubContextReadResultSchema.safeParse({
    displayName,
    memberships,
  });
  if (!parsed.success) {
    readFailure();
  }

  return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapMemberships(rows: readonly unknown[]): unknown[] {
  return rows.map((row) => {
    if (!isRecord(row) || !isRecord(row.clubs)) {
      return null;
    }

    const club = row.clubs;
    return {
      clubId: row.club_id,
      role: row.role,
      active: row.active,
      club: {
        id: club.id,
        name: club.name,
        slug: club.slug,
        timezone: club.timezone,
        themeKey: club.theme_key,
      },
    };
  });
}

function readProfileDisplayName(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const displayName = data.display_name;
  if (typeof displayName !== "string" || displayName.length === 0) {
    return undefined;
  }

  return displayName;
}

async function readOutsiderDisplayName(
  client: SupabaseClient<Database>,
): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error !== null || data.user === null) {
    readFailure();
  }

  return displayNameFromMetadata(data.user.user_metadata);
}

function displayNameFromMetadata(metadata: unknown): string {
  if (!isRecord(metadata)) {
    return SIGNED_IN_DISPLAY_NAME;
  }

  const displayName = metadata.display_name;
  if (typeof displayName === "string" && displayName.length > 0) {
    return displayName;
  }

  return SIGNED_IN_DISPLAY_NAME;
}
