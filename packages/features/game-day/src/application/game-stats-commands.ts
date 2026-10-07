import { ApplicationError } from "@stable/contracts";
import type {
  GuardianLinkFact,
  MembershipFact,
  PlayerTeamRegistrationFact,
  Principal,
  TeamMembershipFact,
} from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";
import { z } from "zod";

const idSchema = z.string().uuid();

const gameStatSchema = z.strictObject({
  points: z.number().int().min(0).max(100),
  rebounds: z.number().int().min(0).max(100),
  assists: z.number().int().min(0).max(100),
  steals: z.number().int().min(0).max(100),
  fouls: z.number().int().min(0).max(20),
  approximateMinutes: z.number().int().min(0).max(120),
});

export type GamePlayerStatValues = z.infer<typeof gameStatSchema>;

const scoreSchema = z.number().int().min(0).max(250);

export const saveManualGameResultSchema = z.strictObject({
  eventId: idSchema,
  teamScore: scoreSchema,
  opponentScore: scoreSchema,
});
export type SaveManualGameResult = z.infer<typeof saveManualGameResultSchema>;

export const saveGamePlayerStatSchema = gameStatSchema.extend({
  eventId: idSchema,
  playerId: idSchema,
});
export type SaveGamePlayerStat = z.infer<typeof saveGamePlayerStatSchema>;

export type GameCoachingStats = {
  eventId: string;
  clubId: string;
  teamId: string;
  source: "MANUAL" | "IMPORT";
  teamScore: number | null;
  opponentScore: number | null;
  resultStatus: "FINAL" | null;
  scheduledMinutes: number | null;
  players: {
    playerId: string;
    displayName: string;
    activeRegistration: boolean;
    stat: GamePlayerStatValues | null;
  }[];
};

export type GamePlayerStatCorrection = {
  eventId: string;
  playerId: string;
  actorId: string;
  occurredAt: string;
  before: GamePlayerStatValues;
  after: GamePlayerStatValues;
};

export type GameStatsAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};

export type GameStatsWriter = {
  readGameCoachingStats(eventId: string): Promise<GameCoachingStats>;
  readGamePlayerStatHistory(
    eventId: string,
  ): Promise<GamePlayerStatCorrection[]>;
  saveManualGameResult(command: SaveManualGameResult): Promise<void>;
  saveGamePlayerStat(command: SaveGamePlayerStat): Promise<void>;
};

function failed(code: "VALIDATION_FAILED" | "FORBIDDEN" | "NOT_FOUND"): never {
  throw new ApplicationError(code, code);
}

function assertAllowed(
  input: GameStatsAccess,
  clubId: string,
  teamId: string,
  capability: "coaching_stats.read" | "coaching_stats.write",
): void {
  if (input.principal === null) {
    throw new ApplicationError("UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  if (
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: { clubId, teamId, teamActive: input.teamActive },
      capability,
    }) !== "allow"
  ) {
    failed("FORBIDDEN");
  }
}

async function readAuthorizedGame(
  input: GameStatsAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: GameStatsWriter;
  },
): Promise<GameCoachingStats> {
  const eventId = idSchema.safeParse(input.eventId);
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!eventId.success || !clubId.success || !teamId.success) {
    failed("VALIDATION_FAILED");
  }
  assertAllowed(input, clubId.data, teamId.data, "coaching_stats.read");
  const game = await input.writer.readGameCoachingStats(eventId.data);
  if (
    game.eventId !== eventId.data ||
    game.clubId !== clubId.data ||
    game.teamId !== teamId.data
  ) {
    failed("NOT_FOUND");
  }
  return game;
}

export async function readGameCoachingStats(
  input: GameStatsAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: GameStatsWriter;
  },
): Promise<GameCoachingStats> {
  return readAuthorizedGame(input);
}

export async function readGamePlayerStatHistory(
  input: GameStatsAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: GameStatsWriter;
  },
): Promise<GamePlayerStatCorrection[]> {
  const game = await readAuthorizedGame(input);
  const history = await input.writer.readGamePlayerStatHistory(game.eventId);
  if (history.some((entry) => entry.eventId !== game.eventId)) {
    failed("NOT_FOUND");
  }
  return history;
}

export async function saveManualGameResult(
  input: GameStatsAccess &
    SaveManualGameResult & {
      clubId: string;
      teamId: string;
      writer: GameStatsWriter;
    },
): Promise<void> {
  const parsed = saveManualGameResultSchema.safeParse({
    eventId: input.eventId,
    teamScore: input.teamScore,
    opponentScore: input.opponentScore,
  });
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!parsed.success || !clubId.success || !teamId.success) {
    failed("VALIDATION_FAILED");
  }
  assertAllowed(input, clubId.data, teamId.data, "coaching_stats.write");
  const game = await readAuthorizedGame({ ...input, ...parsed.data });
  if (game.source !== "MANUAL") {
    failed("FORBIDDEN");
  }
  await input.writer.saveManualGameResult(parsed.data);
}

export async function saveGamePlayerStat(
  input: GameStatsAccess &
    SaveGamePlayerStat & {
      clubId: string;
      teamId: string;
      writer: GameStatsWriter;
    },
): Promise<void> {
  const parsed = saveGamePlayerStatSchema.safeParse({
    eventId: input.eventId,
    playerId: input.playerId,
    points: input.points,
    rebounds: input.rebounds,
    assists: input.assists,
    steals: input.steals,
    fouls: input.fouls,
    approximateMinutes: input.approximateMinutes,
  });
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!parsed.success || !clubId.success || !teamId.success) {
    failed("VALIDATION_FAILED");
  }
  assertAllowed(input, clubId.data, teamId.data, "coaching_stats.write");
  const game = await readAuthorizedGame({ ...input, ...parsed.data });
  const minutesLimit = game.scheduledMinutes ?? 120;
  if (parsed.data.approximateMinutes > minutesLimit) {
    failed("VALIDATION_FAILED");
  }
  await input.writer.saveGamePlayerStat(parsed.data);
}
