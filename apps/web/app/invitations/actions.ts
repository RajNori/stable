"use server";

import { ApplicationError } from "@stable/contracts";
import { INVITATION_TYPES } from "@stable/invitations";
import type { CreateInvitationCommand } from "@stable/invitations";
import {
  acceptInvitation,
  createInvitation,
  createSupabaseInvitationGateway,
  invitationMessages,
  revokeInvitation,
} from "@stable/invitations";
import { createSupabasePlayerGateway } from "@stable/players";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";

export type InvitationActionResult = { token?: string; error?: string };

export async function createInvitationAction(
  formData: FormData,
): Promise<InvitationActionResult> {
  const command = commandFromForm(formData);
  if (command === null) {
    return { error: invitationMessages.validationFailed };
  }

  const supabase = await createSupabaseServerClient();
  const players = createSupabasePlayerGateway(supabase);
  const gateway = createSupabaseInvitationGateway(supabase);

  try {
    const session = await players.readSession();
    const created = await createInvitation({
      principal: session.principal,
      memberships: session.memberships,
      ...command,
      writer: gateway,
    });
    return { token: created.token };
  } catch (error: unknown) {
    return { error: actionMessage(error) };
  }
}

export async function revokeInvitationAction(
  formData: FormData,
): Promise<void> {
  const clubId = formData.get("clubId");
  const invitationId = formData.get("invitationId");
  const returnTo = safeReturn(formData.get("returnTo"));
  if (typeof clubId !== "string" || typeof invitationId !== "string") {
    redirect(
      `${returnTo}?error=${encodeURIComponent(invitationMessages.validationFailed)}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const players = createSupabasePlayerGateway(supabase);
  const gateway = createSupabaseInvitationGateway(supabase);

  try {
    const session = await players.readSession();
    await revokeInvitation({
      principal: session.principal,
      memberships: session.memberships,
      clubId,
      invitationId,
      writer: gateway,
    });
  } catch (error: unknown) {
    redirect(`${returnTo}?error=${encodeURIComponent(actionMessage(error))}`);
  }

  redirect(returnTo);
}

export async function acceptInvitationAction(
  formData: FormData,
): Promise<void> {
  const token = formData.get("token");
  if (typeof token !== "string") {
    redirect(acceptResult(invitationMessages.notFound));
  }

  const supabase = await createSupabaseServerClient();
  const players = createSupabasePlayerGateway(supabase);
  const gateway = createSupabaseInvitationGateway(supabase);

  try {
    const session = await players.readSession();
    await acceptInvitation({
      principal: session.principal,
      token,
      writer: gateway,
    });
  } catch (error: unknown) {
    redirect(acceptResult(actionMessage(error)));
  }

  redirect(acceptResult(invitationMessages.accepted));
}

function commandFromForm(formData: FormData): CreateInvitationCommand | null {
  const clubId = formData.get("clubId");
  const inviteType = formData.get("inviteType");
  const teamId = formData.get("teamId");
  const playerId = formData.get("playerId");
  const intendedEmail = formData.get("intendedEmail");
  const intendedPhone = formData.get("intendedPhone");
  if (typeof clubId !== "string" || !isInviteType(inviteType)) {
    return null;
  }
  return {
    clubId,
    inviteType,
    teamId: typeof teamId === "string" && teamId.length > 0 ? teamId : null,
    playerId:
      typeof playerId === "string" && playerId.length > 0 ? playerId : null,
    intendedEmail:
      typeof intendedEmail === "string" && intendedEmail.length > 0
        ? intendedEmail
        : null,
    intendedPhone:
      typeof intendedPhone === "string" && intendedPhone.length > 0
        ? intendedPhone
        : null,
  };
}

function isInviteType(
  value: FormDataEntryValue | null,
): value is CreateInvitationCommand["inviteType"] {
  return (
    typeof value === "string" &&
    INVITATION_TYPES.some((inviteType) => inviteType === value)
  );
}

function actionMessage(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }
  return invitationMessages.saveFailed;
}

function safeReturn(value: FormDataEntryValue | null): string {
  if (value === "/players") {
    return "/players";
  }
  if (
    typeof value === "string" &&
    /^\/teams\/[0-9a-f-]{36}\/staff$/.test(value)
  ) {
    return value;
  }
  return "/players";
}

function acceptResult(message: string): string {
  return `/invitations/accept?result=${encodeURIComponent(message)}`;
}
