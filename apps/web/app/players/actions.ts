"use server";

import { ApplicationError } from "@stable/contracts";
import {
  createSupabaseMembershipGateway,
  membershipMessages,
  registerPlayerOnTeam,
  unregisterPlayerFromTeam,
} from "@stable/membership";
import {
  PlayerImportValidationError,
  createPlayer,
  createSupabasePlayerGateway,
  deactivatePlayer,
  importPlayers,
  linkGuardian,
  playerMessages,
  reactivatePlayer,
  unlinkGuardian,
  updatePlayerIdentity,
} from "@stable/players";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";

export async function createPlayerAction(formData: FormData): Promise<void> {
  const clubId = formData.get("clubId");
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  if (
    typeof clubId !== "string" ||
    typeof firstName !== "string" ||
    typeof lastName !== "string"
  ) {
    redirect(playersErrorUrl(playerMessages.validationFailed));
  }

  await run(async (gateway, session) => {
    await createPlayer({
      principal: session.principal,
      memberships: session.memberships,
      clubId,
      firstName,
      lastName,
      writer: gateway.writer,
    });
  });
}

export async function importPlayersAction(formData: FormData): Promise<void> {
  const clubId = formData.get("clubId");
  const rawRows = formData.get("rows");
  if (typeof clubId !== "string" || typeof rawRows !== "string") {
    redirect(playersErrorUrl(playerMessages.validationFailed));
  }

  let rows: unknown;
  try {
    rows = JSON.parse(rawRows);
  } catch {
    redirect(playersErrorUrl(playerMessages.validationFailed));
  }
  if (!Array.isArray(rows)) {
    redirect(playersErrorUrl(playerMessages.validationFailed));
  }

  await run(async (gateway, session) => {
    await importPlayers({
      principal: session.principal,
      memberships: session.memberships,
      clubId,
      rows,
      writer: gateway.writer,
    });
  });
}

export async function updatePlayerAction(formData: FormData): Promise<void> {
  const playerId = formData.get("playerId");
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  if (
    typeof playerId !== "string" ||
    typeof firstName !== "string" ||
    typeof lastName !== "string"
  ) {
    redirect(playersErrorUrl(playerMessages.validationFailed));
  }

  await run(async (gateway, session) => {
    await updatePlayerIdentity({
      principal: session.principal,
      memberships: session.memberships,
      playerId,
      firstName,
      lastName,
      directory: gateway.directory,
      writer: gateway.writer,
    });
  });
}

export async function deactivatePlayerAction(
  formData: FormData,
): Promise<void> {
  await changeActive(formData, "deactivate");
}

export async function reactivatePlayerAction(
  formData: FormData,
): Promise<void> {
  await changeActive(formData, "reactivate");
}

export async function linkGuardianAction(formData: FormData): Promise<void> {
  const ids = playerAndGuardian(formData);
  if (ids === null) {
    redirect(playersErrorUrl(playerMessages.validationFailed));
  }

  await run(async (gateway, session) => {
    await linkGuardian({
      principal: session.principal,
      memberships: session.memberships,
      playerId: ids.playerId,
      guardianUserId: ids.guardianUserId,
      directory: gateway.directory,
      writer: gateway.writer,
    });
  });
}

export async function unlinkGuardianAction(formData: FormData): Promise<void> {
  const ids = playerAndGuardian(formData);
  if (ids === null) {
    redirect(playersErrorUrl(playerMessages.validationFailed));
  }

  await run(async (gateway, session) => {
    await unlinkGuardian({
      principal: session.principal,
      memberships: session.memberships,
      playerId: ids.playerId,
      guardianUserId: ids.guardianUserId,
      directory: gateway.directory,
      writer: gateway.writer,
    });
  });
}

async function changeActive(
  formData: FormData,
  change: "deactivate" | "reactivate",
): Promise<void> {
  const playerId = formData.get("playerId");
  if (typeof playerId !== "string") {
    redirect(playersErrorUrl(playerMessages.validationFailed));
  }

  await run(async (gateway, session) => {
    const input = {
      principal: session.principal,
      memberships: session.memberships,
      playerId,
      directory: gateway.directory,
      writer: gateway.writer,
    };
    if (change === "deactivate") {
      await deactivatePlayer(input);
      return;
    }
    await reactivatePlayer(input);
  });
}

function playerAndGuardian(
  formData: FormData,
): { playerId: string; guardianUserId: string } | null {
  const playerId = formData.get("playerId");
  const guardianUserId = formData.get("guardianUserId");
  if (typeof playerId !== "string" || typeof guardianUserId !== "string") {
    return null;
  }
  return { playerId, guardianUserId };
}

async function run(
  work: (
    gateway: ReturnType<typeof createSupabasePlayerGateway>,
    session: Awaited<
      ReturnType<ReturnType<typeof createSupabasePlayerGateway>["readSession"]>
    >,
  ) => Promise<void>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const gateway = createSupabasePlayerGateway(supabase);

  try {
    const session = await gateway.readSession();
    await work(gateway, session);
  } catch (error: unknown) {
    if (error instanceof PlayerImportValidationError) {
      redirect(importErrorUrl(error.rowNumbers));
    }
    const message =
      error instanceof ApplicationError
        ? error.message
        : playerMessages.saveFailed;
    redirect(playersErrorUrl(message));
  }

  redirect("/players");
}

export async function registerPlayerAction(formData: FormData): Promise<void> {
  const clubId = formData.get("clubId");
  const playerId = formData.get("playerId");
  const teamId = formData.get("teamId");
  if (
    typeof clubId !== "string" ||
    typeof playerId !== "string" ||
    typeof teamId !== "string"
  ) {
    redirect(playersErrorUrl(membershipMessages.validationFailed));
  }

  await runMembership(async (gateway, session) => {
    await registerPlayerOnTeam({
      principal: session.principal,
      memberships: session.memberships,
      clubId,
      playerId,
      teamId,
      writer: gateway,
    });
  });
}

export async function unregisterPlayerAction(
  formData: FormData,
): Promise<void> {
  const clubId = formData.get("clubId");
  const playerId = formData.get("playerId");
  if (typeof clubId !== "string" || typeof playerId !== "string") {
    redirect(playersErrorUrl(membershipMessages.validationFailed));
  }

  await runMembership(async (gateway, session) => {
    await unregisterPlayerFromTeam({
      principal: session.principal,
      memberships: session.memberships,
      clubId,
      playerId,
      writer: gateway,
    });
  });
}

async function runMembership(
  work: (
    gateway: ReturnType<typeof createSupabaseMembershipGateway>,
    session: Awaited<
      ReturnType<ReturnType<typeof createSupabasePlayerGateway>["readSession"]>
    >,
  ) => Promise<void>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const players = createSupabasePlayerGateway(supabase);
  const gateway = createSupabaseMembershipGateway(supabase);

  try {
    const session = await players.readSession();
    await work(gateway, session);
  } catch (error: unknown) {
    const message =
      error instanceof ApplicationError
        ? error.message
        : membershipMessages.saveFailed;
    redirect(playersErrorUrl(message));
  }

  redirect("/players");
}

function playersErrorUrl(message: string): string {
  return `/players?error=${encodeURIComponent(message)}`;
}

function importErrorUrl(rowNumbers: readonly number[]): string {
  const params = new URLSearchParams({
    error: playerMessages.importValidationFailed,
  });
  if (rowNumbers.length > 0) {
    params.set("rows", rowNumbers.join(","));
  }
  return `/players?${params.toString()}`;
}
