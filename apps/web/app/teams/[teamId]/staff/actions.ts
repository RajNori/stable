"use server";

import { ApplicationError, TEAM_STAFF_ROLES } from "@stable/contracts";
import type { TeamStaffRole } from "@stable/contracts";
import {
  assignTeamRole,
  createSupabaseMembershipGateway,
  membershipMessages,
  reactivateTeamRole,
  revokeTeamRole,
} from "@stable/membership";
import { createSupabasePlayerGateway } from "@stable/players";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function assignTeamRoleAction(formData: FormData): Promise<void> {
  await changeRole(formData, "assign");
}

export async function revokeTeamRoleAction(formData: FormData): Promise<void> {
  await changeRole(formData, "revoke");
}

export async function reactivateTeamRoleAction(
  formData: FormData,
): Promise<void> {
  await changeRole(formData, "reactivate");
}

async function changeRole(
  formData: FormData,
  change: "assign" | "revoke" | "reactivate",
): Promise<void> {
  const clubId = formData.get("clubId");
  const teamId = formData.get("teamId");
  const userId = formData.get("userId");
  const role = formData.get("role");
  if (
    typeof clubId !== "string" ||
    typeof teamId !== "string" ||
    typeof userId !== "string" ||
    !isStaffRole(role)
  ) {
    redirect(staffErrorUrl(teamId, membershipMessages.validationFailed));
  }

  const supabase = await createSupabaseServerClient();
  const players = createSupabasePlayerGateway(supabase);
  const gateway = createSupabaseMembershipGateway(supabase);

  try {
    const session = await players.readSession();
    const input = {
      principal: session.principal,
      memberships: session.memberships,
      clubId,
      teamId,
      userId,
      role,
      writer: gateway,
    };
    if (change === "assign") {
      await assignTeamRole(input);
    } else if (change === "revoke") {
      await revokeTeamRole(input);
    } else {
      await reactivateTeamRole(input);
    }
  } catch (error: unknown) {
    const message =
      error instanceof ApplicationError
        ? error.message
        : membershipMessages.saveFailed;
    redirect(staffErrorUrl(teamId, message));
  }

  redirect(`/teams/${teamId}/staff`);
}

function isStaffRole(value: FormDataEntryValue | null): value is TeamStaffRole {
  return (
    typeof value === "string" && TEAM_STAFF_ROLES.some((role) => role === value)
  );
}

function staffErrorUrl(teamId: unknown, message: string): string {
  const path =
    typeof teamId === "string" && teamId.length > 0
      ? `/teams/${encodeURIComponent(teamId)}/staff`
      : "/club-structure";
  return `${path}?error=${encodeURIComponent(message)}`;
}
