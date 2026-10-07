import type { Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  acceptDutySwap,
  requestDutySwap,
  type DutySwapWriter,
} from "./duty-swap-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";
const eventId = "55555555-5555-4555-8555-555555555555";
const requestId = "00000000-0000-4000-8000-000000000010";
const principal: Principal = {
  userId: "19191919-1919-4919-8919-191919191919",
  displayName: "Guardian",
};

function guardian() {
  return {
    principal,
    clubMemberships: [] as const,
    teamMemberships: [] as const,
    guardianLinks: [
      {
        clubId,
        playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        active: true,
        playerActive: true,
      },
    ],
    registrations: [
      {
        clubId,
        teamId,
        playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        active: true,
        teamActive: true,
      },
    ],
    teamActive: true,
  };
}

describe("duty swaps", () => {
  it("keeps the accepted swap when the notification outbox fails", async () => {
    const calls: string[] = [];
    const writer: DutySwapWriter = {
      requestDutySwap: () => {
        calls.push("request");
        return Promise.resolve({ requestId });
      },
      acceptDutySwap: () => {
        calls.push("accept");
        return Promise.resolve({ requestId });
      },
      cancelDutySwap: () => Promise.resolve(),
      enqueueDutySwapAccepted: () => Promise.reject(new Error("push down")),
      listOpenDutySwaps: () => Promise.resolve([]),
    };
    await requestDutySwap({
      ...guardian(),
      clubId,
      teamId,
      eventId,
      targetUserId: null,
      writer,
    });
    await expect(
      acceptDutySwap({
        ...guardian(),
        clubId,
        teamId,
        requestId,
        writer,
      }),
    ).resolves.toEqual({ requestId });
    expect(calls).toEqual(["request", "accept"]);
    writer.enqueueDutySwapAccepted = () => Promise.resolve();
    await expect(
      acceptDutySwap({
        ...guardian(),
        clubId,
        teamId,
        requestId,
        writer,
      }),
    ).resolves.toEqual({ requestId });
    await expect(
      requestDutySwap({
        ...guardian(),
        clubId: "nope",
        teamId,
        eventId,
        targetUserId: "also-nope",
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      acceptDutySwap({
        ...guardian(),
        principal: null,
        clubId,
        teamId,
        requestId,
        writer,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      requestDutySwap({
        ...guardian(),
        teamMemberships: [],
        guardianLinks: [],
        registrations: [],
        clubId,
        teamId,
        eventId,
        targetUserId: null,
        writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
