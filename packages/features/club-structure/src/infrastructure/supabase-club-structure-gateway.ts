import {
  ApplicationError,
  CLUB_MEMBERSHIP_ROLES,
  competitionSchema,
  seasonSchema,
  teamSchema,
  venueSchema,
  type ClubStructureSnapshot,
  type Competition,
  type MembershipFact,
  type Principal,
  type Season,
  type Team,
  type Venue,
} from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";

import { clubStructureMessages } from "../application/club-structure-commands.js";
import type {
  ClubStructureDirectory,
  ClubStructureWriter,
} from "../application/club-structure-commands.js";

type QueryError = Pick<PostgrestError, "message">;

type QueryResult = {
  data: unknown;
  error: QueryError | null;
};

type FilterQuery = {
  eq(column: string, value: string): FilterQuery;
  maybeSingle(): Promise<QueryResult>;
} & PromiseLike<QueryResult>;

type StructureClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
  from(table: string): {
    select(columns: string): FilterQuery;
  };
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: QueryError | null;
    }>;
  };
};

export type ClubStructureGateway = {
  directory: ClubStructureDirectory;
  writer: ClubStructureWriter;
  list(clubId: string): Promise<ClubStructureSnapshot>;
  readSession(): Promise<{
    principal: Principal | null;
    memberships: MembershipFact[];
  }>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED)$/;

const SEASON_COLUMNS = "id, club_id, name, active";
const COMPETITION_COLUMNS = "id, club_id, season_id, name, active";
const VENUE_COLUMNS = "id, club_id, name, active";
const TEAM_COLUMNS =
  "id, club_id, season_id, competition_id, venue_id, name, active";
const MEMBERSHIP_COLUMNS = "club_id, role, active";

/**
 * Club-structure reads and audited writes through the caller's session.
 * The client is the user-scoped server client. This adapter never reads a
 * secret key and never forwards database driver text.
 */
export function createSupabaseClubStructureGateway(
  client: unknown,
): ClubStructureGateway {
  const db = client as StructureClient;
  return {
    directory: createDirectory(db),
    writer: createWriter(db),
    list: (clubId) => listStructure(db, clubId),
    readSession: () => readSession(db),
  };
}

function createDirectory(db: StructureClient): ClubStructureDirectory {
  return {
    async findSeason(seasonId) {
      const season = await loadOptional(db, "seasons", seasonId, parseSeason);
      if (season === null) {
        return null;
      }
      return { id: season.id, clubId: season.clubId };
    },
    async findCompetition(competitionId) {
      const competition = await loadOptional(
        db,
        "competitions",
        competitionId,
        parseCompetition,
      );
      if (competition === null) {
        return null;
      }
      return {
        id: competition.id,
        clubId: competition.clubId,
        seasonId: competition.seasonId,
      };
    },
    async findVenue(venueId) {
      const venue = await loadOptional(db, "venues", venueId, parseVenue);
      if (venue === null) {
        return null;
      }
      return { id: venue.id, clubId: venue.clubId };
    },
    async findTeam(teamId) {
      return loadOptional(db, "teams", teamId, parseTeam);
    },
  };
}

function createWriter(db: StructureClient): ClubStructureWriter {
  return {
    async createSeason(command) {
      const created = await callOperation(db, "create_club_season", {
        p_club_id: command.clubId,
        p_name: command.name,
      });
      return parseSeason(created);
    },
    async updateSeason(command) {
      const updated = await callOperation(db, "update_club_season", {
        p_season_id: command.seasonId,
        p_name: command.name,
        p_active: command.active,
      });
      return parseSeason(updated);
    },
    async createCompetition(command) {
      const created = await callOperation(db, "create_club_competition", {
        p_club_id: command.clubId,
        p_season_id: command.seasonId,
        p_name: command.name,
      });
      return parseCompetition(created);
    },
    async updateCompetition(command) {
      const updated = await callOperation(db, "update_club_competition", {
        p_competition_id: command.competitionId,
        p_name: command.name,
        p_active: command.active,
      });
      return parseCompetition(updated);
    },
    async createVenue(command) {
      const created = await callOperation(db, "create_club_venue", {
        p_club_id: command.clubId,
        p_name: command.name,
      });
      return parseVenue(created);
    },
    async updateVenue(command) {
      const updated = await callOperation(db, "update_club_venue", {
        p_venue_id: command.venueId,
        p_name: command.name,
        p_active: command.active,
      });
      return parseVenue(updated);
    },
    async createTeam(command) {
      const created = await callOperation(db, "create_club_team", {
        p_club_id: command.clubId,
        p_season_id: command.seasonId,
        p_competition_id: command.competitionId,
        p_venue_id: command.venueId,
        p_name: command.name,
      });
      return parseTeam(created);
    },
    async updateTeam(command) {
      const updated = await callOperation(db, "update_club_team", {
        p_team_id: command.teamId,
        p_name: command.name,
        p_active: command.active,
      });
      return parseTeam(updated);
    },
    async createSeasonAndTeam(command) {
      const created = await callOperation(db, "create_club_season_and_team", {
        p_club_id: command.clubId,
        p_season_name: command.seasonName,
        p_team_name: command.teamName,
      });
      const seasonId = created.season_id;
      const teamId = created.team_id;
      if (typeof seasonId !== "string" || typeof teamId !== "string") {
        readFailure(clubStructureMessages.saveFailed);
      }
      const season = await loadRequired(db, "seasons", seasonId, parseSeason);
      const team = await loadRequired(db, "teams", teamId, parseTeam);
      return { season, team };
    },
  };
}

async function listStructure(
  db: StructureClient,
  clubId: string,
): Promise<ClubStructureSnapshot> {
  const [seasons, competitions, teams, venues] = await Promise.all([
    selectClubRows(db, "seasons", SEASON_COLUMNS, clubId),
    selectClubRows(db, "competitions", COMPETITION_COLUMNS, clubId),
    selectClubRows(db, "teams", TEAM_COLUMNS, clubId),
    selectClubRows(db, "venues", VENUE_COLUMNS, clubId),
  ]);

  return {
    seasons: seasons.map((row) => parseSeason(row)),
    competitions: competitions.map((row) => parseCompetition(row)),
    teams: teams.map((row) => parseTeam(row)),
    venues: venues.map((row) => parseVenue(row)),
  };
}

async function readSession(db: StructureClient): Promise<{
  principal: Principal | null;
  memberships: MembershipFact[];
}> {
  const userResult = await db.auth.getUser();
  if (userResult.error !== null) {
    readFailure(clubStructureMessages.readFailed);
  }
  if (userResult.data.user === null) {
    return { principal: null, memberships: [] };
  }

  const userId = userResult.data.user.id;
  const result = await db
    .from("club_memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", userId);
  if (result.error !== null || !Array.isArray(result.data)) {
    readFailure(clubStructureMessages.readFailed);
  }

  return {
    principal: { userId },
    memberships: result.data.map((row) => parseMembership(row)),
  };
}

async function callOperation(
  db: StructureClient,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    throwOperationFailure(result.error);
  }
  const row = firstRecord(result.data);
  if (row === null) {
    readFailure(clubStructureMessages.saveFailed);
  }
  return row;
}

async function selectClubRows(
  db: StructureClient,
  table: string,
  columns: string,
  clubId: string,
): Promise<unknown[]> {
  const result = await db.from(table).select(columns).eq("club_id", clubId);
  if (result.error !== null || !Array.isArray(result.data)) {
    readFailure(clubStructureMessages.readFailed);
  }
  return result.data;
}

async function loadOptional<T>(
  db: StructureClient,
  table: string,
  id: string,
  parse: (row: unknown) => T,
): Promise<T | null> {
  const result = await db
    .from(table)
    .select(columnsFor(table))
    .eq("id", id)
    .maybeSingle();
  if (result.error !== null) {
    readFailure(clubStructureMessages.readFailed);
  }
  if (result.data === null) {
    return null;
  }
  return parse(result.data);
}

async function loadRequired<T>(
  db: StructureClient,
  table: string,
  id: string,
  parse: (row: unknown) => T,
): Promise<T> {
  const loaded = await loadOptional(db, table, id, parse);
  if (loaded === null) {
    readFailure(clubStructureMessages.saveFailed);
  }
  return loaded;
}

function columnsFor(table: string): string {
  if (table === "seasons") {
    return SEASON_COLUMNS;
  }
  if (table === "competitions") {
    return COMPETITION_COLUMNS;
  }
  if (table === "venues") {
    return VENUE_COLUMNS;
  }
  return TEAM_COLUMNS;
}

function throwOperationFailure(error: QueryError): never {
  const match = OPERATION_CODE.exec(error.message.trim());
  const code = match?.[1];
  if (code === "UNAUTHENTICATED") {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      clubStructureMessages.unauthenticated,
    );
  }
  if (code === "FORBIDDEN") {
    throw new ApplicationError("FORBIDDEN", clubStructureMessages.forbidden);
  }
  if (code === "NOT_FOUND") {
    throw new ApplicationError("NOT_FOUND", clubStructureMessages.notFound);
  }
  if (code === "VALIDATION_FAILED") {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      clubStructureMessages.validationFailed,
    );
  }
  throw new ApplicationError("INTERNAL", clubStructureMessages.saveFailed);
}

function parseSeason(row: unknown): Season {
  return parseRow(seasonSchema, mapSeason(row));
}

function parseCompetition(row: unknown): Competition {
  return parseRow(competitionSchema, mapCompetition(row));
}

function parseVenue(row: unknown): Venue {
  return parseRow(venueSchema, mapVenue(row));
}

function parseTeam(row: unknown): Team {
  return parseRow(teamSchema, mapTeam(row));
}

function parseRow<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    readFailure(clubStructureMessages.saveFailed);
  }
  return parsed.data;
}

function parseMembership(row: unknown): MembershipFact {
  if (!isRecord(row)) {
    readFailure(clubStructureMessages.readFailed);
  }
  const clubId = row.club_id;
  const role = row.role;
  const active = row.active;
  if (
    typeof clubId !== "string" ||
    typeof role !== "string" ||
    typeof active !== "boolean" ||
    !isClubRole(role)
  ) {
    readFailure(clubStructureMessages.readFailed);
  }
  return { clubId, role, active };
}

function isClubRole(role: string): role is MembershipFact["role"] {
  return CLUB_MEMBERSHIP_ROLES.some((known) => known === role);
}

function mapSeason(row: unknown): unknown {
  if (!isRecord(row)) {
    return null;
  }
  return {
    id: row.id,
    clubId: row.club_id,
    name: row.name,
    active: row.active,
  };
}

function mapCompetition(row: unknown): unknown {
  if (!isRecord(row)) {
    return null;
  }
  return {
    id: row.id,
    clubId: row.club_id,
    seasonId: row.season_id,
    name: row.name,
    active: row.active,
  };
}

function mapVenue(row: unknown): unknown {
  if (!isRecord(row)) {
    return null;
  }
  return {
    id: row.id,
    clubId: row.club_id,
    name: row.name,
    active: row.active,
  };
}

function mapTeam(row: unknown): unknown {
  if (!isRecord(row)) {
    return null;
  }
  return {
    id: row.id,
    clubId: row.club_id,
    seasonId: row.season_id,
    competitionId: row.competition_id,
    venueId: row.venue_id,
    name: row.name,
    active: row.active,
  };
}

function firstRecord(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first: unknown = data[0];
    return isRecord(first) ? first : null;
  }
  return isRecord(data) ? data : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFailure(message: string): never {
  throw new ApplicationError("INTERNAL", message);
}
