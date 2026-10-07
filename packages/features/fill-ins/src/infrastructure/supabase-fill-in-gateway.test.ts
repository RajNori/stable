import { describe, expect, it } from "vitest";

import { createSupabaseFillInGateway } from "./supabase-fill-in-gateway.js";

const id = "55555555-5555-4555-8555-555555555555";
const playerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function client(result: { data: unknown; error: { message: string } | null }) {
  return {
    rpc: () => Promise.resolve(result),
  };
}

describe("fill-in gateway", () => {
  it("maps request, response, and confirmation ids", async () => {
    const gateway = createSupabaseFillInGateway(
      client({ data: id, error: null }),
    );
    await expect(gateway.requestFillIn(id)).resolves.toEqual({
      requestId: id,
    });
    await expect(gateway.respondFillIn(id, playerId)).resolves.toEqual({
      responseId: id,
    });
    await expect(gateway.confirmFillIn(id, playerId)).resolves.toEqual({
      confirmationId: id,
    });
    await expect(gateway.enqueueFillInRequested(id)).resolves.toBeUndefined();
    await expect(gateway.enqueueFillInConfirmed(id)).resolves.toBeUndefined();
  });

  it("maps stable database errors including a prefixed code", async () => {
    const codes = [
      "UNAUTHENTICATED",
      "42501: FORBIDDEN",
      "NOT_FOUND",
      "VALIDATION_FAILED",
      "CONFLICT",
      "NOPE",
    ] as const;
    const expected = [
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "VALIDATION_FAILED",
      "CONFLICT",
      "INTERNAL",
    ] as const;
    for (const [index, code] of codes.entries()) {
      const gateway = createSupabaseFillInGateway(
        client({ data: null, error: { message: code } }),
      );
      await expect(gateway.requestFillIn(id)).rejects.toMatchObject({
        code: expected[index],
      });
    }
  });

  it("reads masked people and an open request", async () => {
    const gateway = createSupabaseFillInGateway(
      client({
        data: [{ player_id: playerId, display_name: "Other C." }],
        error: null,
      }),
    );
    await expect(gateway.listFillInCandidates(id)).resolves.toEqual([
      { playerId, displayName: "Other C." },
    ]);
    await expect(gateway.listFillInResponses(id)).resolves.toEqual([
      { playerId, displayName: "Other C." },
    ]);
    await expect(gateway.listGuardianFillInPlayers(id)).resolves.toEqual([
      { playerId, displayName: "Other C." },
    ]);
  });

  it("returns the open request when one exists", async () => {
    const gateway = createSupabaseFillInGateway(
      client({ data: [{ id, status: "OPEN" }], error: null }),
    );
    await expect(gateway.listEventFillIn(id)).resolves.toEqual({
      id,
      status: "OPEN",
    });
  });

  it("returns no open request when the list is empty", async () => {
    const gateway = createSupabaseFillInGateway(
      client({ data: [], error: null }),
    );
    await expect(gateway.listEventFillIn(id)).resolves.toBeNull();
  });

  it("fails closed on a bad payload", async () => {
    const gateway = createSupabaseFillInGateway(
      client({ data: "nope", error: null }),
    );
    await expect(gateway.requestFillIn(id)).rejects.toMatchObject({
      code: "INTERNAL",
    });
    const listed = createSupabaseFillInGateway(
      client({ data: [{ player_id: "nope" }], error: null }),
    );
    await expect(listed.listFillInCandidates(id)).rejects.toMatchObject({
      code: "INTERNAL",
    });
    const open = createSupabaseFillInGateway(
      client({ data: [{ id: "nope" }], error: null }),
    );
    await expect(open.listEventFillIn(id)).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});
