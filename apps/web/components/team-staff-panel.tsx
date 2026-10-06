import { TEAM_STAFF_ROLES } from "@stable/contracts";
import type { TeamStaffRole } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";

import { InvitationPanel, type InvitationView } from "./invitation-panel";

type FormAction = (formData: FormData) => void | Promise<void>;

export type StaffAssignmentView = {
  id: string;
  userId: string;
  role: TeamStaffRole;
  active: boolean;
  label: string;
};

const ROLE_LABEL: Record<TeamStaffRole, string> = {
  HEAD_COACH: "Head coach",
  ASSISTANT_COACH: "Assistant coach",
  TEAM_MANAGER: "Team manager",
};

export function TeamStaffPanel({
  clubId,
  team,
  adults,
  assignments,
  assignRole,
  revokeRole,
  reactivateRole,
  invitations = [],
  createInvitation,
  revokeInvitation,
  error,
}: {
  clubId: string | null;
  team: { id: string; name: string } | null;
  adults: readonly { userId: string; displayName: string }[];
  assignments: readonly StaffAssignmentView[];
  assignRole: FormAction;
  revokeRole: FormAction;
  reactivateRole: FormAction;
  invitations?: readonly InvitationView[];
  createInvitation?: (
    formData: FormData,
  ) => Promise<{ token?: string; error?: string }>;
  revokeInvitation?: FormAction;
  error?: string | undefined;
}) {
  const theme = themeFor("mustangs");
  const firstAdult = adults[0];

  return (
    <section aria-label="Team staff">
      <p style={{ marginTop: 0 }}>
        <a href="/club-structure">Club structure</a>
      </p>
      <h1 style={{ marginTop: 0 }}>{team?.name ?? "Team staff"}</h1>
      {error === undefined ? null : <p role="alert">{error}</p>}
      {team === null || clubId === null ? null : (
        <>
          <ul aria-label="Staff assignments">
            {assignments.map((assignment) => (
              <li key={assignment.id}>
                {assignment.label} — {ROLE_LABEL[assignment.role]}
                {assignment.active ? "" : " (revoked)"}
                <form action={assignment.active ? revokeRole : reactivateRole}>
                  <input type="hidden" name="clubId" value={clubId} />
                  <input type="hidden" name="teamId" value={team.id} />
                  <input
                    type="hidden"
                    name="userId"
                    value={assignment.userId}
                  />
                  <input type="hidden" name="role" value={assignment.role} />
                  <button type="submit">
                    {assignment.active ? "Revoke" : "Reactivate"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {firstAdult === undefined ? (
            <p>No club adults are available to assign.</p>
          ) : (
            <form action={assignRole}>
              <input type="hidden" name="clubId" value={clubId} />
              <input type="hidden" name="teamId" value={team.id} />
              <label htmlFor="staff-adult">
                Club adult
                <select
                  id="staff-adult"
                  name="userId"
                  defaultValue={firstAdult.userId}
                >
                  {adults.map((adult) => (
                    <option key={adult.userId} value={adult.userId}>
                      {adult.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="staff-role">
                Role
                <select id="staff-role" name="role" defaultValue="HEAD_COACH">
                  {TEAM_STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                style={{
                  minHeight: 44,
                  backgroundColor: theme.color.brand.accent,
                }}
              >
                Assign role
              </button>
            </form>
          )}
          {createInvitation !== undefined && revokeInvitation !== undefined ? (
            <InvitationPanel
              invitations={invitations.filter(
                (invitation) => invitation.teamId === team.id,
              )}
              hidden={{
                clubId,
                teamId: team.id,
                returnTo: `/teams/${team.id}/staff`,
              }}
              includeRole
              createInvitation={createInvitation}
              revokeInvitation={revokeInvitation}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
