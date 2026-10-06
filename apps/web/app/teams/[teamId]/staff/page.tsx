import { ApplicationError } from "@stable/contracts";
import { createSupabaseClubStructureGateway } from "@stable/club-structure";
import { getCurrentClubContext } from "@stable/current-club-context";
import {
  createSupabaseInvitationGateway,
  invitationMessages,
} from "@stable/invitations";
import {
  createSupabaseMembershipGateway,
  membershipMessages,
} from "@stable/membership";
import { createSupabasePlayerGateway } from "@stable/players";

import { ClubAdminShell } from "../../../../components/club-admin-shell";
import { TeamStaffPanel } from "../../../../components/team-staff-panel";
import type { StaffAssignmentView } from "../../../../components/team-staff-panel";
import { loadLiveClubContext } from "../../../../lib/load-live-club-context";
import { principalFromSupabase } from "../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  createInvitationAction,
  revokeInvitationAction,
} from "../../../invitations/actions";
import {
  assignTeamRoleAction,
  reactivateTeamRoleAction,
  revokeTeamRoleAction,
} from "./actions";

export const dynamic = "force-dynamic";

type StaffPageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamStaffPage({
  params,
  searchParams,
}: StaffPageProps) {
  const { teamId } = await params;
  const query = await searchParams;
  const error = allowedStaffError(query["error"]);
  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return <ClubAdminShell presentation={presentation} />;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const principal = await principalFromSupabase(supabase);
    const reader = await createRuntimeClubContextReader(supabase);
    const context = await getCurrentClubContext({ principal, reader });
    if (context.club === null) {
      return <ClubAdminShell presentation={presentation} />;
    }

    const snapshot = await createSupabaseClubStructureGateway(supabase).list(
      context.club.id,
    );
    const team = snapshot.teams.find((item) => item.id === teamId) ?? null;
    const players = createSupabasePlayerGateway(supabase);
    const membership = createSupabaseMembershipGateway(supabase);
    const invitationGateway = createSupabaseInvitationGateway(supabase);
    const [adults, assignments, invitations] = await Promise.all([
      players.listClubAdults(context.club.id),
      team === null ? Promise.resolve([]) : membership.listTeamStaff(team.id),
      invitationGateway.listInvitations(context.club.id),
    ]);
    const names = new Map(
      adults.map((adult) => [adult.userId, adult.displayName]),
    );

    return (
      <ClubAdminShell presentation={presentation}>
        <TeamStaffPanel
          clubId={context.club.id}
          team={team === null ? null : { id: team.id, name: team.name }}
          adults={adults}
          assignments={assignments.map((assignment) =>
            toView(assignment, names),
          )}
          assignRole={assignTeamRoleAction}
          revokeRole={revokeTeamRoleAction}
          reactivateRole={reactivateTeamRoleAction}
          invitations={invitations.map((invitation) => ({
            id: invitation.id,
            status: invitation.status,
            label:
              invitation.intendedEmail ??
              invitation.intendedPhone ??
              "Invitation",
            playerId: invitation.playerId,
            teamId: invitation.teamId,
          }))}
          createInvitation={createInvitationAction}
          revokeInvitation={revokeInvitationAction}
          error={team === null ? membershipMessages.notFound : error}
        />
      </ClubAdminShell>
    );
  } catch (caught: unknown) {
    const message =
      caught instanceof ApplicationError
        ? caught.message
        : membershipMessages.readFailed;
    return (
      <ClubAdminShell presentation={presentation}>
        <TeamStaffPanel
          clubId={null}
          team={null}
          adults={[]}
          assignments={[]}
          assignRole={assignTeamRoleAction}
          revokeRole={revokeTeamRoleAction}
          reactivateRole={reactivateTeamRoleAction}
          error={message}
        />
      </ClubAdminShell>
    );
  }
}

function toView(
  assignment: {
    id: string;
    userId: string;
    role: StaffAssignmentView["role"];
    active: boolean;
  },
  names: ReadonlyMap<string, string>,
): StaffAssignmentView {
  return {
    id: assignment.id,
    userId: assignment.userId,
    role: assignment.role,
    active: assignment.active,
    label: names.get(assignment.userId) ?? "Assigned adult",
  };
}

function allowedStaffError(
  value: string | string[] | undefined,
): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined) {
    return undefined;
  }
  const allowed: readonly string[] = [
    ...Object.values(membershipMessages),
    ...Object.values(invitationMessages),
  ];
  return allowed.includes(text) ? text : undefined;
}
