import { describe, expect, it, vi } from "vitest";

import { createSupabaseReviewGateway } from "./supabase-review-gateway.js";

describe("Supabase review gateway privacy boundary", () => {
  it("uses a distinct RPC for private notes and never adds them to the review projection", async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const client = { rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "read_post_game_review") return { data: [{ event_id: "33333333-3333-4333-8333-333333333333", club_id: "11111111-1111-4111-8111-111111111111", team_id: "22222222-2222-4222-8222-222222222222", what_worked: "Good passing", needs_improvement: "Box out", focus_codes: ["PASSING"], completed_by: null, completed_at: null, recognitions: [] }], error: null };
      if (name === "list_private_player_game_notes") return { data: [{ player_id: "44444444-4444-4444-8444-444444444444", note: "Private confidence note" }], error: null };
      return { data: null, error: null };
    }) };
    const gateway = createSupabaseReviewGateway(client);
    const projection = await gateway.readPostGameReview("33333333-3333-4333-8333-333333333333");
    expect(projection).not.toHaveProperty("privateNotes");
    expect(calls).toEqual([{ name: "read_post_game_review", args: { p_event_id: "33333333-3333-4333-8333-333333333333" } }]);
    await expect(gateway.listPrivatePlayerNotes("33333333-3333-4333-8333-333333333333")).resolves.toEqual([{ playerId: "44444444-4444-4444-8444-444444444444", note: "Private confidence note" }]);
    expect(calls[1]?.name).toBe("list_private_player_game_notes");
  });
});
