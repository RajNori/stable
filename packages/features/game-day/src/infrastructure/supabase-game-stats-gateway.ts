import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  GameCoachingStats,
  GamePlayerStatCorrection,
  GamePlayerStatValues,
  GameStatsWriter,
  SaveGamePlayerStat,
  SaveManualGameResult,
} from "../application/game-stats-commands.js";
import { gameStatsMessages } from "../application/game-stats-messages.js";

type QueryError = Pick<PostgrestError, "message">;
type QueryResult = { data: unknown; error: QueryError | null };
type GameStatsClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const operationCode =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|CONFLICT)$/;

const rawRowSchema = z.strictObject({
  event_id: z.string().uuid(),
  club_id: z.string().uuid(),
  team_id: z.string().uuid(),
  source: z.enum(["MANUAL", "IMPORT"]),
  team_score: z.number().int().nullable(),
  opponent_score: z.number().int().nullable(),
  result_status: z.literal("FINAL").nullable(),
  scheduled_minutes: z.number().int().nonnegative().nullable(),
  player_id: z.string().uuid().nullable(),
  player_display_name: z.string().nullable(),
  active_registration: z.boolean().nullable(),
  points: z.number().int().nullable(),
  rebounds: z.number().int().nullable(),
  assists: z.number().int().nullable(),
  steals: z.number().int().nullable(),
  fouls: z.number().int().nullable(),
  approximate_minutes: z.number().int().nullable(),
});

const rawCorrectionSchema = z.strictObject({
  event_id: z.string().uuid(),
  player_id: z.string().uuid(),
  actor_user_id: z.string().uuid(),
  occurred_at: z.string().datetime({ offset: true }),
  before_points: z.number().int().min(0).max(100),
  before_rebounds: z.number().int().min(0).max(100),
  before_assists: z.number().int().min(0).max(100),
  before_steals: z.number().int().min(0).max(100),
  before_fouls: z.number().int().min(0).max(20),
  before_approximate_minutes: z.number().int().min(0).max(120),
  after_points: z.number().int().min(0).max(100),
  after_rebounds: z.number().int().min(0).max(100),
  after_assists: z.number().int().min(0).max(100),
  after_steals: z.number().int().min(0).max(100),
  after_fouls: z.number().int().min(0).max(20),
  after_approximate_minutes: z.number().int().min(0).max(120),
});

function statFromRow(
  row: z.infer<typeof rawRowSchema>,
): GamePlayerStatValues | null {
  if (
    row.points === null ||
    row.rebounds === null ||
    row.assists === null ||
    row.steals === null ||
    row.fouls === null ||
    row.approximate_minutes === null
  ) {
    return null;
  }
  return {
    points: row.points,
    rebounds: row.rebounds,
    assists: row.assists,
    steals: row.steals,
    fouls: row.fouls,
    approximateMinutes: row.approximate_minutes,
  };
}

export function createSupabaseGameStatsGateway(
  client: unknown,
): GameStatsWriter {
  return {
    readGameCoachingStats: (eventId) =>
      readGameCoachingStats(client as GameStatsClient, eventId),
    readGamePlayerStatHistory: (eventId) =>
      readGamePlayerStatHistory(client as GameStatsClient, eventId),
    saveManualGameResult: (command) =>
      saveManualGameResult(client as GameStatsClient, command),
    saveGamePlayerStat: (command) =>
      saveGamePlayerStat(client as GameStatsClient, command),
  };
}

async function readGamePlayerStatHistory(
  db: GameStatsClient,
  eventId: string,
): Promise<GamePlayerStatCorrection[]> {
  const data = await call(db, "read_game_player_stat_history", {
    p_event_id: eventId,
  });
  const rows = z.array(rawCorrectionSchema).safeParse(data);
  if (!rows.success) {
    throw new ApplicationError("INTERNAL", gameStatsMessages.readFailed);
  }
  return rows.data.map((row) => ({
    eventId: row.event_id,
    playerId: row.player_id,
    actorId: row.actor_user_id,
    occurredAt: row.occurred_at,
    before: {
      points: row.before_points,
      rebounds: row.before_rebounds,
      assists: row.before_assists,
      steals: row.before_steals,
      fouls: row.before_fouls,
      approximateMinutes: row.before_approximate_minutes,
    },
    after: {
      points: row.after_points,
      rebounds: row.after_rebounds,
      assists: row.after_assists,
      steals: row.after_steals,
      fouls: row.after_fouls,
      approximateMinutes: row.after_approximate_minutes,
    },
  }));
}

async function readGameCoachingStats(
  db: GameStatsClient,
  eventId: string,
): Promise<GameCoachingStats> {
  const data = await call(db, "read_game_coaching_stats", {
    p_event_id: eventId,
  });
  const rows = z.array(rawRowSchema).safeParse(data);
  if (!rows.success || rows.data.length === 0) {
    throw new ApplicationError("INTERNAL", gameStatsMessages.readFailed);
  }
  const first = rows.data[0];
  if (first === undefined) {
    throw new ApplicationError("INTERNAL", gameStatsMessages.readFailed);
  }
  return {
    eventId: first.event_id,
    clubId: first.club_id,
    teamId: first.team_id,
    source: first.source,
    teamScore: first.team_score,
    opponentScore: first.opponent_score,
    resultStatus: first.result_status,
    scheduledMinutes: first.scheduled_minutes,
    players: rows.data.flatMap((row) => {
      if (row.player_id === null || row.player_display_name === null) {
        return [];
      }
      return [
        {
          playerId: row.player_id,
          displayName: row.player_display_name,
          activeRegistration: row.active_registration === true,
          stat: statFromRow(row),
        },
      ];
    }),
  };
}

async function saveManualGameResult(
  db: GameStatsClient,
  command: SaveManualGameResult,
): Promise<void> {
  await call(db, "save_manual_game_result", {
    p_event_id: command.eventId,
    p_team_score: command.teamScore,
    p_opponent_score: command.opponentScore,
  });
}

async function saveGamePlayerStat(
  db: GameStatsClient,
  command: SaveGamePlayerStat,
): Promise<void> {
  await call(db, "save_game_player_stat", {
    p_event_id: command.eventId,
    p_player_id: command.playerId,
    p_points: command.points,
    p_rebounds: command.rebounds,
    p_assists: command.assists,
    p_steals: command.steals,
    p_fouls: command.fouls,
    p_approximate_minutes: command.approximateMinutes,
  });
}

async function call(
  db: GameStatsClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    const code = operationCode.exec(result.error.message)?.[1];
    if (
      code === "UNAUTHENTICATED" ||
      code === "FORBIDDEN" ||
      code === "NOT_FOUND" ||
      code === "VALIDATION_FAILED" ||
      code === "CONFLICT"
    ) {
      throw new ApplicationError(
        code,
        gameStatsMessages[
          code === "UNAUTHENTICATED"
            ? "unauthenticated"
            : code === "FORBIDDEN"
              ? "forbidden"
              : code === "NOT_FOUND"
                ? "notFound"
                : code === "VALIDATION_FAILED"
                  ? "validationFailed"
                  : "saveFailed"
        ],
      );
    }
    throw new ApplicationError("INTERNAL", gameStatsMessages.saveFailed);
  }
  return result.data;
}
