import {
  clubContextReadResultSchema,
  type ClubContextReadResult,
  type ClubContextReader,
  type ClubSummary,
  type TeamRecord,
} from "@stable/contracts";
import type { Database } from "@stable/database-types";
import type { SupabaseClient } from "@supabase/supabase-js";

const READ_FAILURE_MESSAGE = "Club context could not be read.";
const SIGNED_IN_DISPLAY_NAME = "Signed in";
const MEMBERSHIP_COLUMNS =
  "club_id, role, active, clubs(id, name, slug, timezone, theme_key)";
const TEAM_MEMBERSHIP_COLUMNS =
  "club_id, team_id, role, active, teams(id, name, active, club_id, clubs(id, name, slug, timezone, theme_key))";
const GUARDIAN_COLUMNS = "club_id, player_id, active";
const REGISTRATION_COLUMNS =
  "club_id, team_id, player_id, active, teams(id, name, active, club_id, clubs(id, name, slug, timezone, theme_key))";

/**
 * Reads club context through the caller's Supabase client.
 * Active club memberships, team staff rows, guardian links, and the
 * registrations those links may see are selected. Child names are not
 * selected. This function does not accept or read a secret key.
 */
export function createSupabaseClubContextReader(
  client: unknown,
): ClubContextReader {
  const db = client as SupabaseClient<Database>;
  return {
    async read(userId: string): Promise<ClubContextReadResult> {
      const membershipRows = rowsOf(
        await db
          .from("club_memberships")
          .select(MEMBERSHIP_COLUMNS)
          .eq("user_id", userId)
          .eq("active", true),
      );
      const teamRows = rowsOf(
        await db
          .from("team_memberships")
          .select(TEAM_MEMBERSHIP_COLUMNS)
          .eq("user_id", userId)
          .eq("active", true),
      );
      const guardianRows = rowsOf(
        await db
          .from("guardian_relationships")
          .select(GUARDIAN_COLUMNS)
          .eq("user_id", userId)
          .eq("active", true),
      );
      const registrationRows = rowsOf(
        await db
          .from("player_team_registrations")
          .select(REGISTRATION_COLUMNS)
          .eq("active", true),
      );

      const clubs = new Map<string, ClubSummary>();
      const teams = new Map<string, TeamRecord>();
      const memberships = mapMemberships(membershipRows, clubs);
      const teamMemberships = mapTeamMemberships(teamRows, clubs, teams);
      const registrations = mapRegistrations(registrationRows, clubs, teams);
      const guardianLinks = await mapGuardianLinks(db, guardianRows);

      const profileResult = await db
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileResult.error !== null) {
        readFailure();
      }

      const profileName = readProfileDisplayName(profileResult.data);
      const hasClubOrTeamAccess =
        memberships.length > 0 || teamMemberships.length > 0;
      if (hasClubOrTeamAccess && profileName === undefined) {
        readFailure();
      }
      const displayName = profileName ?? (await readOutsiderDisplayName(db));

      return parseResult({
        displayName,
        memberships,
        teamMemberships,
        guardianLinks,
        registrations,
        teams: [...teams.values()],
        clubs: [...clubs.values()],
      });
    },
  };
}

function readFailure(): never {
  throw new Error(READ_FAILURE_MESSAGE);
}

function rowsOf(result: {
  data: unknown;
  error: { message: string } | null;
}): unknown[] {
  if (result.error !== null || !Array.isArray(result.data)) {
    readFailure();
  }
  return result.data;
}

function parseResult(value: unknown): ClubContextReadResult {
  const parsed = clubContextReadResultSchema.safeParse(value);
  if (!parsed.success) {
    readFailure();
  }
  return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function embedded(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    return isRecord(first) ? first : null;
  }
  return isRecord(value) ? value : null;
}

function mapClub(value: unknown): ClubSummary | null {
  const club = embedded(value);
  if (club === null) {
    return null;
  }
  if (
    typeof club.id !== "string" ||
    typeof club.name !== "string" ||
    typeof club.slug !== "string" ||
    typeof club.timezone !== "string" ||
    typeof club.theme_key !== "string"
  ) {
    return null;
  }
  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
    timezone: club.timezone,
    themeKey: club.theme_key,
  };
}

function rememberClub(
  clubs: Map<string, ClubSummary>,
  club: ClubSummary | null,
): void {
  if (club !== null) {
    clubs.set(club.id, club);
  }
}

function rememberTeam(
  teams: Map<string, TeamRecord>,
  team: Record<string, unknown>,
  clubs: Map<string, ClubSummary>,
): TeamRecord | null {
  if (
    typeof team.id !== "string" ||
    typeof team.name !== "string" ||
    typeof team.club_id !== "string" ||
    typeof team.active !== "boolean"
  ) {
    return null;
  }
  const record: TeamRecord = {
    id: team.id,
    name: team.name,
    clubId: team.club_id,
    active: team.active,
  };
  teams.set(record.id, record);
  rememberClub(clubs, mapClub(team.clubs));
  return record;
}

function mapMemberships(
  rows: readonly unknown[],
  clubs: Map<string, ClubSummary>,
): unknown[] {
  return rows.map((row) => {
    if (!isRecord(row)) {
      return null;
    }
    const club = mapClub(row.clubs);
    if (club === null) {
      return null;
    }
    rememberClub(clubs, club);
    return {
      clubId: row.club_id,
      role: row.role,
      active: row.active,
      club,
    };
  });
}

function mapTeamMemberships(
  rows: readonly unknown[],
  clubs: Map<string, ClubSummary>,
  teams: Map<string, TeamRecord>,
): unknown[] {
  return rows.map((row) => {
    if (!isRecord(row)) {
      return null;
    }
    const team = embedded(row.teams);
    if (team === null) {
      return null;
    }
    const record = rememberTeam(teams, team, clubs);
    if (record === null) {
      return null;
    }
    return {
      clubId: row.club_id,
      teamId: row.team_id,
      role: row.role,
      active: row.active,
      teamActive: record.active,
    };
  });
}

function mapRegistrations(
  rows: readonly unknown[],
  clubs: Map<string, ClubSummary>,
  teams: Map<string, TeamRecord>,
): unknown[] {
  return rows.map((row) => {
    if (!isRecord(row)) {
      return null;
    }
    const team = embedded(row.teams);
    if (team === null) {
      return null;
    }
    const record = rememberTeam(teams, team, clubs);
    if (record === null) {
      return null;
    }
    return {
      clubId: row.club_id,
      teamId: row.team_id,
      playerId: row.player_id,
      active: row.active,
      teamActive: record.active,
    };
  });
}

async function mapGuardianLinks(
  db: SupabaseClient<Database>,
  rows: readonly unknown[],
): Promise<unknown[]> {
  const links: unknown[] = [];
  for (const row of rows) {
    if (!isRecord(row) || typeof row.player_id !== "string") {
      return [null];
    }
    const activePlayer = await db.rpc("player_is_active", {
      p_player_id: row.player_id,
    });
    if (activePlayer.error !== null || typeof activePlayer.data !== "boolean") {
      readFailure();
    }
    links.push({
      clubId: row.club_id,
      playerId: row.player_id,
      active: row.active,
      playerActive: activePlayer.data,
    });
  }
  return links;
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
