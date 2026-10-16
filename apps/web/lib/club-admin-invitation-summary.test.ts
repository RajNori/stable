import { describe, expect, it } from "vitest";

import { summarizeClubInvitations } from "./club-admin-invitation-summary";

const invitation = (
  overrides: Partial<
    Parameters<typeof summarizeClubInvitations>[0][number]
  > = {},
) => ({
  id: "11111111-1111-4111-8111-111111111111",
  clubId: "22222222-2222-4222-8222-222222222222",
  teamId: null,
  playerId: null,
  inviteType: "GUARDIAN" as const,
  intendedEmail: "private@example.invalid",
  intendedPhone: null,
  expiresAt: "2026-10-18T00:00:00.000Z",
  consumedAt: null,
  revokedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  status: "pending" as const,
  ...overrides,
});

describe("summarizeClubInvitations", () => {
  it("returns only pending and soon-expiring counts", () => {
    expect(
      summarizeClubInvitations(
        [
          invitation(),
          invitation({
            id: "33333333-3333-4333-8333-333333333333",
            expiresAt: "2026-10-30T00:00:00.000Z",
          }),
          invitation({
            id: "44444444-4444-4444-8444-444444444444",
            status: "expired",
            expiresAt: "2026-10-01T00:00:00.000Z",
          }),
          invitation({
            id: "55555555-5555-4555-8555-555555555555",
            status: "consumed",
          }),
          invitation({
            id: "66666666-6666-4666-8666-666666666666",
            status: "revoked",
          }),
        ],
        new Date("2026-10-13T00:00:00.000Z"),
      ),
    ).toEqual({ pendingCount: 2, expiringWithinSevenDaysCount: 1 });
  });

  it("does not count already expired pending rows as soon to expire", () => {
    expect(
      summarizeClubInvitations(
        [invitation({ expiresAt: "2026-10-12T23:59:59.000Z" })],
        new Date("2026-10-13T00:00:00.000Z"),
      ),
    ).toEqual({ pendingCount: 1, expiringWithinSevenDaysCount: 0 });
  });
});
