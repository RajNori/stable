import type { Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  confirmFillIn,
  listFillInCandidates,
  listGuardianFillInPlayers,
  requestFillIn,
  respondFillIn,
  type FillInAccess,
  type FillInWriter,
} from "./fill-in-commands.js";
import { fillInMessages } from "./fill-in-messages.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";
const eventId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const playerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "19191919-1919-4919-8919-191919191919";

const principal: Principal = { userId, displayName: "Manager" };

function access(
  role: "TEAM_MANAGER" | "ASSISTANT_COACH" | "GUARDIAN" | "NONE",
): FillInAccess {
  if (role === "GUARDIAN") {
    return {
      principal,
      clubMemberships: [],
      teamMemberships: [],
      guardianLinks: [{ clubId, playerId, active: true, playerActive: true }],
      registrations: [],
      teamActive: true,
    };
  }
  if (role === "NONE") {
    return {
      principal: null,
      clubMemberships: [],
      teamMemberships: [],
      guardianLinks: [],
      registrations: [],
      teamActive: true,
    };
  }
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [{ clubId, teamId, role, active: true, teamActive: true }],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
  };
}

function writer(failEnqueue = false): FillInWriter & { enqueued: string[] } {
  const enqueued: string[] = [];
  return {
    enqueued,
    requestFillIn: () => Promise.resolve({ requestId }),
    respondFillIn: () =>
      Promise.resolve({ responseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    confirmFillIn: () =>
      Promise.resolve({
        confirmationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    listFillInCandidates: () =>
      Promise.resolve([{ playerId, displayName: "Other C." }]),
    listEventFillIn: () => Promise.resolve(null),
    listFillInResponses: () => Promise.resolve([]),
    listGuardianFillInPlayers: () =>
      Promise.resolve([{ playerId, displayName: "Other C." }]),
    enqueueFillInRequested: (id) => {
      enqueued.push(id);
      return failEnqueue
        ? Promise.reject(new Error("push down"))
        : Promise.resolve();
    },
    enqueueFillInConfirmed: (id) => {
      enqueued.push(id);
      return failEnqueue
        ? Promise.reject(new Error("push down"))
        : Promise.resolve();
    },
  };
}

describe("fill-in commands", () => {
  it("lets a manager request and keeps the request when delivery fails", async () => {
    const delivered = writer();
    await requestFillIn({
      ...access("TEAM_MANAGER"),
      clubId,
      teamId,
      eventId,
      writer: delivered,
    });
    expect(delivered.enqueued).toEqual([requestId]);
    const saved = writer(true);
    const requested = await requestFillIn({
      ...access("TEAM_MANAGER"),
      clubId,
      teamId,
      eventId,
      writer: saved,
    });
    expect(requested.requestId).toBe(requestId);
    expect(saved.enqueued).toEqual([requestId]);
  });

  it("denies an assistant and a missing principal", async () => {
    await expect(
      requestFillIn({
        ...access("ASSISTANT_COACH"),
        clubId,
        teamId,
        eventId,
        writer: writer(),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: fillInMessages.forbidden,
    });
    await expect(
      requestFillIn({
        ...access("NONE"),
        clubId,
        teamId,
        eventId,
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects an invalid event id", async () => {
    await expect(
      requestFillIn({
        ...access("TEAM_MANAGER"),
        clubId,
        teamId,
        eventId: "nope",
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("lets the linked guardian respond and denies another adult", async () => {
    const responded = await respondFillIn({
      ...access("GUARDIAN"),
      requestId,
      playerId,
      writer: writer(),
    });
    expect(responded.responseId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    await expect(
      respondFillIn({
        ...access("TEAM_MANAGER"),
        requestId,
        playerId,
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      respondFillIn({
        ...access("GUARDIAN"),
        requestId: "nope",
        playerId,
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      listGuardianFillInPlayers({
        ...access("GUARDIAN"),
        teamId: "nope",
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("confirms one candidate and keeps it when delivery fails", async () => {
    const delivered = writer();
    await confirmFillIn({
      ...access("TEAM_MANAGER"),
      clubId,
      teamId,
      requestId,
      playerId,
      writer: delivered,
    });
    expect(delivered.enqueued).toEqual([requestId]);
    const saved = writer(true);
    const confirmed = await confirmFillIn({
      ...access("TEAM_MANAGER"),
      clubId,
      teamId,
      requestId,
      playerId,
      writer: saved,
    });
    expect(confirmed.confirmationId).toBe(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    );
    expect(saved.enqueued).toEqual([requestId]);
  });

  it("lists masked candidates for a manager and the guardian's own players", async () => {
    const candidates = await listFillInCandidates({
      ...access("TEAM_MANAGER"),
      clubId,
      teamId,
      writer: writer(),
    });
    expect(candidates[0]?.displayName).toBe("Other C.");
    const own = await listGuardianFillInPlayers({
      ...access("GUARDIAN"),
      teamId,
      writer: writer(),
    });
    expect(own).toHaveLength(1);
    await expect(
      listGuardianFillInPlayers({
        ...access("NONE"),
        teamId,
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      listFillInCandidates({
        ...access("TEAM_MANAGER"),
        clubId: "bad",
        teamId,
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
