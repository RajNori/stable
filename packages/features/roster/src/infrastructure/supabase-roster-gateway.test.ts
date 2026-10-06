import { describe, expect, it } from "vitest";

import { rosterMessages } from "../application/roster-commands.js";
import { createSupabaseRosterGateway } from "./supabase-roster-gateway.js";

const teamId = "99999999-9999-4999-8999-999999999999";
const playerId = "18181818-1818-4818-8818-181818181818";

function client(result: { data: unknown; error: { message: string } | null }) {
  const calls: string[] = [];
  return {
    calls,
    rpc(name: string) {
      calls.push(name);
      return Promise.resolve(result);
    },
  };
}

describe("roster gateway", () => {
  it("keeps the masked projection and drops any extra name field", async () => {
    const db = client({
      data: [
        {
          player_id: playerId,
          team_id: teamId,
          display_name: "Alexander R.",
          registered_name: "Alexander Robertson",
          email: "child@example.com",
        },
      ],
      error: null,
    });

    const entries = await createSupabaseRosterGateway(db).listMasked(teamId);

    expect(db.calls).toEqual(["list_team_roster_masked"]);
    expect(entries).toEqual([{ playerId, teamId, name: "Alexander R." }]);
    expect(JSON.stringify(entries)).not.toContain("Robertson");
    expect(JSON.stringify(entries)).not.toContain("child@example.com");
  });

  it("reads the registered name from the full projection", async () => {
    const db = client({
      data: [
        {
          player_id: playerId,
          team_id: teamId,
          registered_name: "Alexander Robertson",
        },
      ],
      error: null,
    });

    const entries = await createSupabaseRosterGateway(db).listFull(teamId);

    expect(entries[0]?.name).toBe("Alexander Robertson");
    expect(JSON.stringify(entries)).not.toContain("email");
  });

  it("maps authorization failures to fixed messages and drops driver text", async () => {
    await expect(
      createSupabaseRosterGateway(
        client({ data: null, error: { message: "42501: FORBIDDEN" } }),
      ).listFull(teamId),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: rosterMessages.forbidden,
    });

    await expect(
      createSupabaseRosterGateway(
        client({
          data: null,
          error: { message: "42501: FORBIDDEN child@example.com" },
        }),
      ).listMasked(teamId),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: rosterMessages.readFailed,
    });

    await expect(
      createSupabaseRosterGateway(
        client({ data: null, error: { message: "P0002: NOT_FOUND" } }),
      ).listFull(teamId),
    ).rejects.toMatchObject({ message: rosterMessages.notFound });

    await expect(
      createSupabaseRosterGateway(
        client({ data: null, error: { message: "28000: UNAUTHENTICATED" } }),
      ).registerPlayer(playerId, teamId),
    ).rejects.toMatchObject({ message: rosterMessages.unauthenticated });

    await expect(
      createSupabaseRosterGateway(
        client({ data: null, error: { message: "23514: VALIDATION_FAILED" } }),
      ).unregisterPlayer(playerId),
    ).rejects.toMatchObject({ message: rosterMessages.validationFailed });
  });

  it("fails closed when the roster payload is not a list of names", async () => {
    await expect(
      createSupabaseRosterGateway(
        client({ data: null, error: null }),
      ).listMasked(teamId),
    ).rejects.toMatchObject({ message: rosterMessages.readFailed });

    await expect(
      createSupabaseRosterGateway(client({ data: [{}], error: null })).listFull(
        teamId,
      ),
    ).rejects.toMatchObject({ message: rosterMessages.readFailed });
  });
});
