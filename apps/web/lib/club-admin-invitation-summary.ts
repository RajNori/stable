import type { InvitationRecord } from "@stable/invitations";

export type ClubAdminInvitationSummary = {
  pendingCount: number;
  expiringWithinSevenDaysCount: number;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function summarizeClubInvitations(
  invitations: readonly InvitationRecord[],
  now: Date,
): ClubAdminInvitationSummary {
  const nowMs = now.getTime();
  const windowEndMs = nowMs + SEVEN_DAYS_MS;
  const pending = invitations.filter(
    (invitation) => invitation.status === "pending",
  );

  return {
    pendingCount: pending.length,
    expiringWithinSevenDaysCount: pending.filter((invitation) => {
      const expiresAtMs = Date.parse(invitation.expiresAt);
      return expiresAtMs > nowMs && expiresAtMs <= windowEndMs;
    }).length,
  };
}
