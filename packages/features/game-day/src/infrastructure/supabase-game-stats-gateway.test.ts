import { describe, expect, it, vi } from "vitest";

import { ApplicationError } from "@stable/contracts";

import { createSupabaseGameStatsGateway } from "./supabase-game-stats-gateway.js";

const eventId = "55555555-5555-4555-8555-555555555555";
const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const playerId = "66666666-6666-4666-8666-666666666666";

function row(overrides: Record<string, unknown> = {}) {
  return {
    event_id: eventId,
    club_id: clubId,
    team_id: teamId,
    source: "MANUAL",
    team_score: 62,
    opponent_score: 59,
    result_status: "FINAL",
    scheduled_minutes: 40,
    player_id: playerId,
    player_display_name: "Alex Example",
    active_registration: true,
    points: 10,
    rebounds: 3,
    assists: 1,
    steals: 0,
    fouls: 1,
    approximate_minutes: 30,
    ...overrides,
  };
}

describe("Supabase game stats gateway", () => {
  it("maps the restricted RPC projection without adding fields", async () => {
    const rpc = vi.fn(async () => ({ data: [row()], error: null }));
    const gateway = createSupabaseGameStatsGateway({ rpc });
    await expect(gateway.readGameCoachingStats(eventId)).resolves.toEqual({
      eventId,
      clubId,
      teamId,
      source: "MANUAL",
      teamScore: 62,
      opponentScore: 59,
      resultStatus: "FINAL",
      scheduledMinutes: 40,
      players: [
        {
          playerId,
          displayName: "Alex Example",
          activeRegistration: true,
          stat: {
            points: 10,
            rebounds: 3,
            assists: 1,
            steals: 0,
            fouls: 1,
            approximateMinutes: 30,
          },
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("read_game_coaching_stats", {
      p_event_id: eventId,
    });
  });

  it("uses dedicated score and stat RPCs with only typed numeric inputs", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const gateway = createSupabaseGameStatsGateway({ rpc });
    await gateway.saveManualGameResult({
      eventId,
      teamScore: 62,
      opponentScore: 59,
    });
    await gateway.saveGamePlayerStat({
      eventId,
      playerId,
      points: 10,
      rebounds: 3,
      assists: 1,
      steals: 0,
      fouls: 1,
      approximateMinutes: 30,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "save_manual_game_result", {
      p_event_id: eventId,
      p_team_score: 62,
      p_opponent_score: 59,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "save_game_player_stat", {
      p_event_id: eventId,
      p_player_id: playerId,
      p_points: 10,
      p_rebounds: 3,
      p_assists: 1,
      p_steals: 0,
      p_fouls: 1,
      p_approximate_minutes: 30,
    });
  });

  it("maps only opaque ids, timestamp, and numeric values from restricted history", async () => {
    const correction = {
      event_id: eventId,
      player_id: playerId,
      actor_user_id: "77777777-7777-4777-8777-777777777777",
      occurred_at: "2026-10-07T10:00:00.000Z",
      before_points: 10,
      before_rebounds: 3,
      before_assists: 1,
      before_steals: 0,
      before_fouls: 1,
      before_approximate_minutes: 30,
      after_points: 12,
      after_rebounds: 3,
      after_assists: 1,
      after_steals: 0,
      after_fouls: 1,
      after_approximate_minutes: 121,
    };
    const rpc = vi.fn(async () => ({ data: [correction], error: null }));
    const gateway = createSupabaseGameStatsGateway({ rpc });
    await expect(gateway.readGamePlayerStatHistory(eventId)).resolves.toEqual([
      {
        eventId,
        playerId,
        actorId: correction.actor_user_id,
        occurredAt: correction.occurred_at,
        before: {
          points: 10,
          rebounds: 3,
          assists: 1,
          steals: 0,
          fouls: 1,
          approximateMinutes: 30,
        },
        after: {
          points: 12,
          rebounds: 3,
          assists: 1,
          steals: 0,
          fouls: 1,
          approximateMinutes: 121,
        },
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("read_game_player_stat_history", {
      p_event_id: eventId,
    });
  });

  it("rejects history payloads containing child names or other unexpected fields", async () => {
    const gateway = createSupabaseGameStatsGateway({
      rpc: vi.fn(async () => ({
        data: [
          {
            event_id: eventId,
            player_id: playerId,
            actor_user_id: "77777777-7777-4777-8777-777777777777",
            occurred_at: "2026-10-07T10:00:00.000Z",
            before_points: 1,
            before_rebounds: 0,
            before_assists: 0,
            before_steals: 0,
            before_fouls: 0,
            before_approximate_minutes: 1,
            after_points: 2,
            after_rebounds: 0,
            after_assists: 0,
            after_steals: 0,
            after_fouls: 0,
            after_approximate_minutes: 1,
            player_name: "Private Name",
          },
        ],
        error: null,
      })),
    });
    await expect(
      gateway.readGamePlayerStatHistory(eventId),
    ).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });

  it("maps authorization and validation errors to safe application messages", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "42501: FORBIDDEN" },
    }));
    const gateway = createSupabaseGameStatsGateway({ rpc });
    await expect(
      gateway.saveManualGameResult({
        eventId,
        teamScore: 1,
        opponentScore: 0,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "23514: VALIDATION_FAILED" },
    });
    await expect(
      gateway.saveGamePlayerStat({
        eventId,
        playerId,
        points: 1,
        rebounds: 0,
        assists: 0,
        steals: 0,
        fouls: 0,
        approximateMinutes: 1,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
  });

  it("rejects malformed projections rather than leaking unexpected values", async () => {
    const gateway = createSupabaseGameStatsGateway({
      rpc: vi.fn(async () => ({
        data: [row({ extra_note: "private text" })],
        error: null,
      })),
    });
    await expect(gateway.readGameCoachingStats(eventId)).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});
