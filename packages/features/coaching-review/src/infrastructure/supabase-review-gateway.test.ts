import { describe, expect, it, vi } from "vitest";

import { ApplicationError } from "@stable/contracts";

import { createSupabaseReviewGateway } from "./supabase-review-gateway.js";

const eventId = "33333333-3333-4333-8333-333333333333";
const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "22222222-2222-4222-8222-222222222222";
const playerId = "44444444-4444-4444-8444-444444444444";
const coachId = "55555555-5555-4555-8555-555555555555";

const reviewRow = {
  event_id: eventId,
  club_id: clubId,
  team_id: teamId,
  what_worked: "Good passing",
  needs_improvement: "Box out",
  focus_codes: ["PASSING"],
  completed_by: coachId,
  completed_at: "2026-10-07T10:00:00Z",
  recognitions: [{ player_id: playerId, category: "HUSTLE", note: "Kept working" }],
};

function clientFor(data: unknown = null, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc }, rpc };
}

describe("Supabase review gateway", () => {
  it("maps the review projection and keeps private notes in a dedicated RPC", async () => {
    const rpc = vi.fn(async (name: string) => ({ data: name === "read_post_game_review" ? [reviewRow] : [], error: null }));
    const client = { rpc };
    const gateway = createSupabaseReviewGateway(client);
    await expect(gateway.readPostGameReview(eventId)).resolves.toEqual({
      eventId, clubId, teamId, whatWorked: "Good passing", needsImprovement: "Box out",
      focusCodes: ["PASSING"], completedBy: coachId, completedAt: "2026-10-07T10:00:00Z",
      recognitions: [{ playerId, category: "HUSTLE", note: "Kept working" }],
    });
    expect(rpc).toHaveBeenCalledWith("read_post_game_review", { p_event_id: eventId });
    await expect(gateway.listPrivatePlayerNotes(eventId)).resolves.toEqual([]);
    expect(rpc).toHaveBeenLastCalledWith("list_private_player_game_notes", { p_event_id: eventId });
  });

  it("forwards each write and private-note RPC with explicit arguments", async () => {
    const { client, rpc } = clientFor(null);
    const gateway = createSupabaseReviewGateway(client);
    await gateway.savePostGameReview({ eventId, whatWorked: "Worked", needsImprovement: "Improve", focusCodes: ["DEFENCE"], complete: true });
    await gateway.savePlayerRecognition({ eventId, playerId, category: "MVP", note: null });
    await gateway.removePlayerRecognition(eventId, playerId, "HUSTLE");
    await gateway.readPrivatePlayerNote(eventId, playerId);
    await gateway.savePrivatePlayerNote({ eventId, playerId, note: "Private" });
    expect(rpc.mock.calls).toEqual([
      ["save_post_game_review", { p_event_id: eventId, p_what_worked: "Worked", p_needs_improvement: "Improve", p_focus_codes: ["DEFENCE"], p_complete: true }],
      ["save_player_game_recognition", { p_event_id: eventId, p_player_id: playerId, p_category: "MVP", p_note: null }],
      ["remove_player_game_recognition", { p_event_id: eventId, p_player_id: playerId, p_category: "HUSTLE" }],
      ["read_private_player_game_note", { p_event_id: eventId, p_player_id: playerId }],
      ["save_private_player_game_note", { p_event_id: eventId, p_player_id: playerId, p_note: "Private" }],
    ]);
  });

  it("maps empty or malformed review payloads to a safe internal error", async () => {
    for (const data of [[], [{ ...reviewRow, completed_at: "yesterday" }], [{ ...reviewRow, recognitions: [{ player_id: playerId, category: "UNKNOWN", note: null }] }], { ...reviewRow }]) {
      const gateway = createSupabaseReviewGateway(clientFor(data).client);
      await expect(gateway.readPostGameReview(eventId)).rejects.toMatchObject({ code: "INTERNAL", message: "Post-game review could not be loaded." });
    }
  });

  it("validates private note response shapes before returning them", async () => {
    const privateRead = createSupabaseReviewGateway(clientFor({ note: "leak" }).client);
    await expect(privateRead.readPrivatePlayerNote(eventId, playerId)).rejects.toMatchObject({ code: "INTERNAL", message: "Private coaching note could not be loaded." });
    for (const data of [[{ player_id: "invalid", note: "Private" }], [{ player_id: playerId, note: "Private", unexpected: true }], "wrong shape"]) {
      const gateway = createSupabaseReviewGateway(clientFor(data).client);
      await expect(gateway.listPrivatePlayerNotes(eventId)).rejects.toMatchObject({ code: "INTERNAL", message: "Private coaching notes could not be loaded." });
    }
  });

  it.each([
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "VALIDATION_FAILED",
    "CONFLICT",
    "P0001: FORBIDDEN",
  ])("maps recognized operation error %s", async (message) => {
    const gateway = createSupabaseReviewGateway(clientFor(null, { message }).client);
    await expect(gateway.savePrivatePlayerNote({ eventId, playerId, note: "Private" })).rejects.toMatchObject({ code: message.includes(":") ? "FORBIDDEN" : message, message: message.includes(":") ? "FORBIDDEN" : message });
  });

  it("hides unrecognized database errors behind a generic internal error", async () => {
    for (const message of ["permission denied for relation", "XX000: private note text included in database detail", "P0001: conflict with extra text"]) {
      const gateway = createSupabaseReviewGateway(clientFor(null, { message }).client);
      await expect(gateway.savePrivatePlayerNote({ eventId, playerId, note: "Private" })).rejects.toEqual(new ApplicationError("INTERNAL", "Coaching review could not be saved or loaded."));
    }
  });
});
