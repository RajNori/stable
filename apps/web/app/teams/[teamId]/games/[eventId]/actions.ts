"use server";

import { ApplicationError } from "@stable/contracts";
import {
  attendanceMessages,
  createSupabaseAttendanceGateway,
  recordAttendance,
} from "@stable/attendance";
import { redirect } from "next/navigation";

import { fixtureAccessFrom } from "../../../../../lib/fixture-access";
import { principalFromSupabase } from "../../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function destination(teamId: string, eventId: string): string {
  return `/teams/${teamId}/games/${eventId}`;
}

function withError(path: string, message: string): string {
  return `${path}?error=${encodeURIComponent(message)}`;
}

export async function recordAttendanceAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const eventId = text(formData, "eventId");
  const playerId = text(formData, "playerId");
  const status = text(formData, "status");
  const category = text(formData, "absenceCategory");
  const attendanceStatus =
    status === "ATTENDING" || status === "UNAVAILABLE" || status === "UNSURE"
      ? status
      : null;
  const absenceCategory =
    category === "SICK" ||
    category === "INJURY" ||
    category === "FAMILY" ||
    category === "OTHER"
      ? category
      : null;
  const canReturn =
    teamId !== null &&
    eventId !== null &&
    UUID.test(teamId) &&
    UUID.test(eventId);
  if (
    clubId === null ||
    teamId === null ||
    eventId === null ||
    playerId === null ||
    attendanceStatus === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId) ||
    !UUID.test(eventId) ||
    !UUID.test(playerId)
  ) {
    redirect(
      canReturn
        ? withError(
            destination(teamId, eventId),
            attendanceMessages.validationFailed,
          )
        : "/",
    );
  }

  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  const reader = await createRuntimeClubContextReader(supabase);
  const facts = principal === null ? null : await reader.read(principal.userId);
  if (principal === null || facts === null) {
    redirect(
      withError(
        destination(teamId, eventId),
        attendanceMessages.unauthenticated,
      ),
    );
  }

  const teamActive =
    facts.teams.find((team) => team.id === teamId)?.active === true;
  try {
    await recordAttendance({
      ...fixtureAccessFrom(principal, facts, teamActive),
      clubId,
      teamId,
      eventId,
      playerId,
      status: attendanceStatus,
      absenceCategory,
      privateNote: text(formData, "privateNote"),
      writer: createSupabaseAttendanceGateway(supabase),
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof ApplicationError
        ? caught.message
        : attendanceMessages.saveFailed;
    redirect(withError(destination(teamId, eventId), message));
  }

  redirect(destination(teamId, eventId));
}
