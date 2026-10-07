import type { Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  acknowledgeGameDuty,
  commitDutyAllocation,
  createOpenGameDuty,
  previewDutyAllocation,
  type DutyAllocationWriter,
} from "./duty-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";
const eventId = "55555555-5555-4555-8555-555555555555";
const dutyId = "00000000-0000-4000-8000-000000000010";
const userId = "19191919-1919-4919-8919-191919191919";
const principal: Principal = { userId, displayName: "Manager" };

function manager() {
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [
      {
        clubId,
        teamId,
        role: "TEAM_MANAGER" as const,
        active: true,
        teamActive: true,
      },
    ],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
  };
}

function writer(): DutyAllocationWriter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    createOpenDuty: () => Promise.resolve({ dutyId }),
    listDutyAllocationInputs: () => {
      calls.push("list");
      return Promise.resolve({
        duties: [{ dutyId, dutyType: "SCORER", label: "Score" }],
        candidates: [
          { userId, priorCount: 1 },
          {
            userId: "00000000-0000-4000-8000-000000000002",
            priorCount: 0,
          },
        ],
      });
    },
    commitDutyAllocation: (_eventId, fingerprint) => {
      calls.push(fingerprint);
      return Promise.resolve();
    },
    acknowledgeOwnDuty: () => Promise.resolve(1),
  };
}

describe("duty commands", () => {
  it("previews from history and denies a head coach the commit", async () => {
    const calls = writer();
    await createOpenGameDuty({
      ...manager(),
      clubId,
      teamId,
      eventId,
      dutyType: "SCORER",
      label: "Score",
      writer: calls,
    });
    const preview = await previewDutyAllocation({
      ...manager(),
      clubId,
      teamId,
      eventId,
      writer: calls,
    });
    expect(preview.fingerprint).toBe(
      `${dutyId}:00000000-0000-4000-8000-000000000002:0`,
    );
    await commitDutyAllocation({
      ...manager(),
      clubId,
      teamId,
      eventId,
      fingerprint: preview.fingerprint,
      writer: calls,
    });
    await expect(
      commitDutyAllocation({
        ...manager(),
        teamMemberships: [
          {
            clubId,
            teamId,
            role: "HEAD_COACH",
            active: true,
            teamActive: true,
          },
        ],
        clubId,
        teamId,
        eventId,
        fingerprint: preview.fingerprint,
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      acknowledgeGameDuty({
        ...manager(),
        teamMemberships: [],
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
        clubId,
        teamId,
        eventId,
        writer: calls,
      }),
    ).resolves.toBe(1);
    await expect(
      createOpenGameDuty({
        ...manager(),
        clubId: "nope",
        teamId,
        eventId,
        dutyType: "SCORER",
        label: "Score",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      previewDutyAllocation({
        ...manager(),
        principal: null,
        clubId,
        teamId,
        eventId,
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      commitDutyAllocation({
        ...manager(),
        clubId,
        teamId,
        eventId,
        fingerprint: " ",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      acknowledgeGameDuty({
        ...manager(),
        clubId,
        teamId,
        eventId: "nope",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
