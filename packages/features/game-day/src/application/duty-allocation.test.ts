import { describe, expect, it } from "vitest";

import {
  compareDutyCandidates,
  proposeDutyAllocation,
} from "./duty-allocation.js";

const firstUser = "00000000-0000-4000-8000-000000000001";
const secondUser = "00000000-0000-4000-8000-000000000002";
const firstDuty = "00000000-0000-4000-8000-000000000010";
const secondDuty = "00000000-0000-4000-8000-000000000011";

describe("duty allocation", () => {
  it("breaks equal counts by user id in both directions", () => {
    expect(
      compareDutyCandidates(
        { userId: secondUser, priorCount: 1 },
        { userId: firstUser, priorCount: 1 },
      ),
    ).toBe(1);
    expect(
      compareDutyCandidates(
        { userId: firstUser, priorCount: 1 },
        { userId: secondUser, priorCount: 1 },
      ),
    ).toBe(-1);
    expect(
      compareDutyCandidates(
        { userId: firstUser, priorCount: 0 },
        { userId: firstUser, priorCount: 2 },
      ),
    ).toBe(-2);
    expect(
      compareDutyCandidates(
        { userId: firstUser, priorCount: 1 },
        { userId: firstUser, priorCount: 1 },
      ),
    ).toBe(0);
  });

  it("gives the next open duty to the adult with the fewest assignments", () => {
    const allocation = proposeDutyAllocation({
      duties: [
        { dutyId: secondDuty, dutyType: "CLOCK", label: "Clock" },
        { dutyId: firstDuty, dutyType: "SCORER", label: "Score" },
      ],
      candidates: [
        { userId: firstUser, priorCount: 2 },
        { userId: secondUser, priorCount: 0 },
      ],
    });
    expect(allocation.proposals).toEqual([
      { dutyId: firstDuty, userId: secondUser, priorCount: 0 },
      { dutyId: secondDuty, userId: secondUser, priorCount: 1 },
    ]);
    expect(allocation.fingerprint).toBe(
      `${firstDuty}:${secondUser}:0|${secondDuty}:${secondUser}:1`,
    );
  });

  it("rotates a second duty after the first proposal", () => {
    const allocation = proposeDutyAllocation({
      duties: [
        { dutyId: firstDuty, dutyType: "SCORER", label: "Score" },
        { dutyId: secondDuty, dutyType: "CANTEEN", label: "Canteen" },
      ],
      candidates: [
        { userId: secondUser, priorCount: 0 },
        { userId: firstUser, priorCount: 0 },
      ],
    });
    expect(allocation.fingerprint).toBe(
      `${firstDuty}:${firstUser}:0|${secondDuty}:${secondUser}:0`,
    );
  });

  it("returns an empty fingerprint when nobody is eligible", () => {
    expect(
      proposeDutyAllocation({
        duties: [{ dutyId: firstDuty, dutyType: "OTHER", label: "Door" }],
        candidates: [],
      }).fingerprint,
    ).toBe("");
  });
});
