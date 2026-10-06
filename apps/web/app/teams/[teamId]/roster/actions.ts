"use server";

import { ApplicationError } from "@stable/contracts";
import {
  createSupabaseRosterGateway,
  registerRosterPlayer,
  rosterMessages,
  unregisterRosterPlayer,
} from "@stable/roster";
import { redirect } from "next/navigation";

import { loadRosterRequest } from "../../../../lib/load-roster-facts";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function registerRosterPlayerAction(
  formData: FormData,
): Promise<void> {
  await changeRoster(formData, "register");
}

export async function unregisterRosterPlayerAction(
  formData: FormData,
): Promise<void> {
  await changeRoster(formData, "unregister");
}

async function changeRoster(
  formData: FormData,
  change: "register" | "unregister",
): Promise<void> {
  const teamId = text(formData.get("teamId"));
  const clubId = text(formData.get("clubId"));
  const playerId = text(formData.get("playerId"));
  const destination = rosterReturn(teamId);
  if (teamId === null || clubId === null || playerId === null) {
    redirect(withError(destination, rosterMessages.validationFailed));
  }

  const loaded = await loadRosterRequest(teamId);
  if (loaded.facts === null || loaded.facts.clubId !== clubId) {
    redirect(withError(destination, rosterMessages.forbidden));
  }

  const supabase = await createSupabaseServerClient();
  const writer = createSupabaseRosterGateway(supabase);
  try {
    if (change === "register") {
      await registerRosterPlayer({ ...loaded.facts, playerId, writer });
    } else {
      await unregisterRosterPlayer({ ...loaded.facts, playerId, writer });
    }
  } catch (error: unknown) {
    redirect(withError(destination, actionMessage(error)));
  }

  redirect(destination);
}

function text(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value;
}

function rosterReturn(teamId: string | null): string {
  if (teamId !== null && /^[0-9a-f-]{36}$/.test(teamId)) {
    return `/teams/${teamId}/roster`;
  }
  return "/club-structure";
}

function withError(path: string, message: string): string {
  return `${path}?error=${encodeURIComponent(message)}`;
}

function actionMessage(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }
  return rosterMessages.saveFailed;
}
