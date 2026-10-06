import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import {
  fixtureRecordSchema,
  type FixtureOverlay,
  type FixtureRecord,
  type FixtureWriter,
  type ImportedFixture,
  type OfficialFixture,
  type OfficialFixtureUpdate,
} from "../application/fixture-commands.js";
import { fixtureMessages } from "../application/fixture-messages.js";

type QueryError = Pick<PostgrestError, "message">;

type QueryResult = {
  data: unknown;
  error: QueryError | null;
};

type TeamQuery = {
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): {
      maybeSingle(): Promise<QueryResult>;
    };
  };
};

type FixtureClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
  from(table: string): TeamQuery;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|CONFLICT)$/;

const fixtureRowSchema = z
  .strictObject({
    event_id: z.string().uuid(),
    club_id: z.string().uuid(),
    team_id: z.string().uuid(),
    starts_at: z.string(),
    ends_at: z.string().nullable(),
    venue_id: z.string().uuid().nullable(),
    court_label: z.string().nullable(),
    event_status: z.string(),
    competition_id: z.string().uuid().nullable(),
    round_label: z.string().nullable(),
    opponent_name: z.string(),
    source: z.string(),
    external_id: z.string().nullable(),
    official_start_at: z.string(),
    official_venue_text: z.string().nullable(),
    official_court_label: z.string().nullable(),
    fixture_status: z.string(),
    home_away: z.string().nullable(),
    team_score: z.number().nullable(),
    opponent_score: z.number().nullable(),
    result_status: z.string().nullable(),
    last_external_sync_at: z.string().nullable(),
    arrival_at: z.string().nullable(),
    uniform_note: z.string().nullable(),
    coach_focus: z.string().nullable(),
    team_note: z.string().nullable(),
  })
  .transform((row) => ({
    eventId: row.event_id,
    clubId: row.club_id,
    teamId: row.team_id,
    startsAt: asInstant(row.starts_at),
    endsAt: asInstant(row.ends_at),
    venueId: row.venue_id,
    courtLabel: row.court_label,
    eventStatus: row.event_status,
    competitionId: row.competition_id,
    roundLabel: row.round_label,
    opponentName: row.opponent_name,
    source: row.source,
    externalId: row.external_id,
    officialStartAt: asInstant(row.official_start_at),
    officialVenueText: row.official_venue_text,
    officialCourtLabel: row.official_court_label,
    fixtureStatus: row.fixture_status,
    homeAway: row.home_away,
    teamScore: row.team_score,
    opponentScore: row.opponent_score,
    resultStatus: row.result_status,
    lastExternalSyncAt: asInstant(row.last_external_sync_at),
    arrivalAt: asInstant(row.arrival_at),
    uniformNote: row.uniform_note,
    coachFocus: row.coach_focus,
    teamNote: row.team_note,
  }));

const visibleTeamSchema = z
  .strictObject({
    id: z.string().uuid(),
    name: z.string().min(1),
    active: z.boolean(),
    club_id: z.string().uuid(),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
    clubId: row.club_id,
  }));

export type VisibleTeam = z.infer<typeof visibleTeamSchema>;

export type FixtureGateway = FixtureWriter & {
  readVisibleTeam(teamId: string): Promise<VisibleTeam | null>;
};

export function createSupabaseFixtureGateway(client: unknown): FixtureGateway {
  const db = client as FixtureClient;
  return {
    createManualFixture: (command) => createManualFixture(db, command),
    importFixture: (command) => importFixture(db, command),
    updateOfficialFixture: (command) => updateOfficialFixture(db, command),
    updateFixtureOverlay: (command) => updateFixtureOverlay(db, command),
    readFixture: (eventId) => readFixture(db, eventId),
    listTeamFixtures: (teamId) => listTeamFixtures(db, teamId),
    readVisibleTeam: (teamId) => readVisibleTeam(db, teamId),
  };
}

function officialArgs(command: OfficialFixture): Record<string, unknown> {
  return {
    p_club_id: command.clubId,
    p_team_id: command.teamId,
    p_starts_at: command.startsAt,
    p_ends_at: command.endsAt,
    p_venue_id: command.venueId,
    p_court_label: command.courtLabel,
    p_competition_id: command.competitionId,
    p_round_label: command.roundLabel,
    p_opponent_name: command.opponentName,
    p_official_start_at: command.officialStartAt,
    p_official_venue_text: command.officialVenueText,
    p_official_court_label: command.officialCourtLabel,
    p_home_away: command.homeAway,
  };
}

async function createManualFixture(
  db: FixtureClient,
  command: OfficialFixture,
): Promise<{ eventId: string }> {
  const data = await callOperation(
    db,
    "create_manual_fixture",
    officialArgs(command),
    fixtureMessages.saveFailed,
  );
  return { eventId: eventIdFrom(data) };
}

async function importFixture(
  db: FixtureClient,
  command: ImportedFixture,
): Promise<{ eventId: string }> {
  const data = await callOperation(
    db,
    "import_fixture",
    { ...officialArgs(command), p_external_id: command.externalId },
    fixtureMessages.saveFailed,
  );
  return { eventId: eventIdFrom(data) };
}

async function updateOfficialFixture(
  db: FixtureClient,
  command: OfficialFixtureUpdate,
): Promise<void> {
  await callOperation(
    db,
    "update_official_fixture",
    {
      ...officialArgs(command),
      p_event_id: command.eventId,
      p_fixture_status: command.fixtureStatus,
      p_team_score: command.teamScore,
      p_opponent_score: command.opponentScore,
      p_result_status: command.resultStatus,
    },
    fixtureMessages.saveFailed,
  );
}

async function updateFixtureOverlay(
  db: FixtureClient,
  command: FixtureOverlay,
): Promise<void> {
  await callOperation(
    db,
    "update_fixture_overlay",
    {
      p_event_id: command.eventId,
      p_arrival_at: command.arrivalAt,
      p_uniform_note: command.uniformNote,
      p_coach_focus: command.coachFocus,
      p_team_note: command.teamNote,
    },
    fixtureMessages.saveFailed,
  );
}

async function readFixture(
  db: FixtureClient,
  eventId: string,
): Promise<FixtureRecord> {
  const data = await callOperation(
    db,
    "read_fixture",
    { p_event_id: eventId },
    fixtureMessages.readFailed,
  );
  return parseFixture(firstRow(data), fixtureMessages.readFailed);
}

async function listTeamFixtures(
  db: FixtureClient,
  teamId: string,
): Promise<FixtureRecord[]> {
  const data = await callOperation(
    db,
    "list_team_fixtures",
    { p_team_id: teamId },
    fixtureMessages.readFailed,
  );
  if (!Array.isArray(data)) {
    throw new ApplicationError("INTERNAL", fixtureMessages.readFailed);
  }
  return data.map((row) => parseFixture(row, fixtureMessages.readFailed));
}

async function readVisibleTeam(
  db: FixtureClient,
  teamId: string,
): Promise<VisibleTeam | null> {
  const result = await db
    .from("teams")
    .select("id, name, active, club_id")
    .eq("id", teamId)
    .maybeSingle();
  if (result.error !== null) {
    throw new ApplicationError("INTERNAL", fixtureMessages.readFailed);
  }
  if (result.data === null) {
    return null;
  }
  const parsed = visibleTeamSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", fixtureMessages.readFailed);
  }
  return parsed.data;
}

async function callOperation(
  db: FixtureClient,
  name: string,
  args: Record<string, unknown>,
  failed: string,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    throwOperationFailure(result.error, failed);
  }
  return result.data;
}

function asInstant(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
}

function firstRow(data: unknown): unknown {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new ApplicationError("NOT_FOUND", fixtureMessages.notFound);
    }
    return data[0];
  }
  return data;
}

function eventIdFrom(data: unknown): string {
  const parsed = z.string().uuid().safeParse(firstRow(data));
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", fixtureMessages.saveFailed);
  }
  return parsed.data;
}

function parseFixture(row: unknown, failed: string): FixtureRecord {
  const mapped = fixtureRowSchema.safeParse(row);
  if (!mapped.success) {
    throw new ApplicationError("INTERNAL", failed);
  }
  const parsed = fixtureRecordSchema.safeParse(mapped.data);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", failed);
  }
  return parsed.data;
}

function throwOperationFailure(error: QueryError, failed: string): never {
  const code = OPERATION_CODE.exec(error.message)?.[1];
  if (code === "UNAUTHENTICATED") {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      fixtureMessages.unauthenticated,
    );
  }
  if (code === "FORBIDDEN") {
    throw new ApplicationError("FORBIDDEN", fixtureMessages.forbidden);
  }
  if (code === "NOT_FOUND") {
    throw new ApplicationError("NOT_FOUND", fixtureMessages.notFound);
  }
  if (code === "VALIDATION_FAILED") {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      fixtureMessages.validationFailed,
    );
  }
  if (code === "CONFLICT") {
    throw new ApplicationError("CONFLICT", fixtureMessages.conflict);
  }
  throw new ApplicationError("INTERNAL", failed);
}
