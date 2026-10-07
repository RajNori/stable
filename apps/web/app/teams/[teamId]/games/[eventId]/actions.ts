"use server";

import { ApplicationError } from "@stable/contracts";
import {
  attendanceMessages,
  createSupabaseAttendanceGateway,
  recordAttendance,
} from "@stable/attendance";
import {
  acceptDutySwap,
  acknowledgeGameDuty,
  commitDutyAllocation,
  createOpenGameDuty,
  createSupabaseGameDayGateway,
  gameDayMessages,
  requestDutySwap,
} from "@stable/game-day";
import { createSupabaseFixtureGateway } from "@stable/fixtures";
import { DUTY_TYPES } from "@stable/game-day";
import {
  confirmFillIn,
  createSupabaseFillInGateway,
  fillInMessages,
  requestFillIn,
  respondFillIn,
} from "@stable/fill-ins";
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

  const visibleTeam =
    await createSupabaseFixtureGateway(supabase).readVisibleTeam(teamId);
  if (visibleTeam === null || visibleTeam.clubId !== clubId) {
    redirect(
      withError(destination(teamId, eventId), attendanceMessages.notFound),
    );
  }
  const teamActive = visibleTeam.active;
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

async function dutyAccess(formData: FormData) {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const eventId = text(formData, "eventId");
  if (
    clubId === null ||
    teamId === null ||
    eventId === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId) ||
    !UUID.test(eventId)
  ) {
    redirect(
      teamId !== null &&
        eventId !== null &&
        UUID.test(teamId) &&
        UUID.test(eventId)
        ? withError(
            destination(teamId, eventId),
            gameDayMessages.validationFailed,
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
      withError(destination(teamId, eventId), gameDayMessages.unauthenticated),
    );
  }
  const visibleTeam =
    await createSupabaseFixtureGateway(supabase).readVisibleTeam(teamId);
  if (visibleTeam === null || visibleTeam.clubId !== clubId) {
    redirect(withError(destination(teamId, eventId), gameDayMessages.notFound));
  }
  const teamActive = visibleTeam.active;
  return {
    access: fixtureAccessFrom(principal, facts, teamActive),
    clubId,
    teamId,
    eventId,
    writer: createSupabaseGameDayGateway(supabase),
  };
}

export async function createOpenDutyAction(formData: FormData): Promise<void> {
  const loaded = await dutyAccess(formData);
  const dutyType = text(formData, "dutyType");
  const label = text(formData, "label");
  if (
    dutyType === null ||
    label === null ||
    !DUTY_TYPES.some((item) => item === dutyType)
  ) {
    redirect(
      withError(
        destination(loaded.teamId, loaded.eventId),
        gameDayMessages.validationFailed,
      ),
    );
  }
  try {
    await createOpenGameDuty({
      ...loaded.access,
      clubId: loaded.clubId,
      teamId: loaded.teamId,
      eventId: loaded.eventId,
      dutyType,
      label,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error ? caught.message : gameDayMessages.saveFailed;
    redirect(withError(destination(loaded.teamId, loaded.eventId), message));
  }
  redirect(destination(loaded.teamId, loaded.eventId));
}

export async function commitDutyAllocationAction(
  formData: FormData,
): Promise<void> {
  const loaded = await dutyAccess(formData);
  const fingerprint = text(formData, "fingerprint");
  if (fingerprint === null) {
    redirect(
      withError(
        destination(loaded.teamId, loaded.eventId),
        gameDayMessages.validationFailed,
      ),
    );
  }
  try {
    await commitDutyAllocation({
      ...loaded.access,
      clubId: loaded.clubId,
      teamId: loaded.teamId,
      eventId: loaded.eventId,
      fingerprint,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error ? caught.message : gameDayMessages.saveFailed;
    redirect(withError(destination(loaded.teamId, loaded.eventId), message));
  }
  redirect(destination(loaded.teamId, loaded.eventId));
}

export async function acknowledgeDutyAction(formData: FormData): Promise<void> {
  const loaded = await dutyAccess(formData);
  try {
    await acknowledgeGameDuty({
      ...loaded.access,
      clubId: loaded.clubId,
      teamId: loaded.teamId,
      eventId: loaded.eventId,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error ? caught.message : gameDayMessages.saveFailed;
    redirect(withError(destination(loaded.teamId, loaded.eventId), message));
  }
  redirect(destination(loaded.teamId, loaded.eventId));
}

export async function requestDutySwapAction(formData: FormData): Promise<void> {
  const loaded = await dutyAccess(formData);
  const target = text(formData, "targetUserId");
  try {
    await requestDutySwap({
      ...loaded.access,
      clubId: loaded.clubId,
      teamId: loaded.teamId,
      eventId: loaded.eventId,
      targetUserId: target,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error ? caught.message : gameDayMessages.saveFailed;
    redirect(withError(destination(loaded.teamId, loaded.eventId), message));
  }
  redirect(destination(loaded.teamId, loaded.eventId));
}

export async function acceptDutySwapAction(formData: FormData): Promise<void> {
  const loaded = await dutyAccess(formData);
  const requestId = text(formData, "requestId");
  if (requestId === null || !UUID.test(requestId)) {
    redirect(
      withError(
        destination(loaded.teamId, loaded.eventId),
        gameDayMessages.validationFailed,
      ),
    );
  }
  try {
    await acceptDutySwap({
      ...loaded.access,
      clubId: loaded.clubId,
      teamId: loaded.teamId,
      requestId,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error ? caught.message : gameDayMessages.saveFailed;
    redirect(withError(destination(loaded.teamId, loaded.eventId), message));
  }
  redirect(destination(loaded.teamId, loaded.eventId));
}

async function fillInAccess(formData: FormData) {
  const loaded = await dutyAccess(formData);
  const supabase = await createSupabaseServerClient();
  return {
    access: loaded.access,
    clubId: loaded.clubId,
    teamId: loaded.teamId,
    eventId: loaded.eventId,
    writer: createSupabaseFillInGateway(supabase),
  };
}

export async function requestFillInAction(formData: FormData): Promise<void> {
  const loaded = await fillInAccess(formData);
  try {
    await requestFillIn({
      ...loaded.access,
      clubId: loaded.clubId,
      teamId: loaded.teamId,
      eventId: loaded.eventId,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error ? caught.message : fillInMessages.saveFailed;
    redirect(withError(destination(loaded.teamId, loaded.eventId), message));
  }
  redirect(destination(loaded.teamId, loaded.eventId));
}

export async function respondFillInAction(formData: FormData): Promise<void> {
  const loaded = await fillInAccess(formData);
  const requestId = text(formData, "requestId");
  const playerId = text(formData, "playerId");
  if (
    requestId === null ||
    playerId === null ||
    !UUID.test(requestId) ||
    !UUID.test(playerId)
  ) {
    redirect(
      withError(
        destination(loaded.teamId, loaded.eventId),
        fillInMessages.validationFailed,
      ),
    );
  }
  try {
    await respondFillIn({
      ...loaded.access,
      requestId,
      playerId,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error ? caught.message : fillInMessages.saveFailed;
    redirect(withError(destination(loaded.teamId, loaded.eventId), message));
  }
  redirect(destination(loaded.teamId, loaded.eventId));
}

export async function confirmFillInAction(formData: FormData): Promise<void> {
  const loaded = await fillInAccess(formData);
  const requestId = text(formData, "requestId");
  const playerId = text(formData, "playerId");
  if (
    requestId === null ||
    playerId === null ||
    !UUID.test(requestId) ||
    !UUID.test(playerId)
  ) {
    redirect(
      withError(
        destination(loaded.teamId, loaded.eventId),
        fillInMessages.validationFailed,
      ),
    );
  }
  try {
    await confirmFillIn({
      ...loaded.access,
      clubId: loaded.clubId,
      teamId: loaded.teamId,
      requestId,
      playerId,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error ? caught.message : fillInMessages.saveFailed;
    redirect(withError(destination(loaded.teamId, loaded.eventId), message));
  }
  redirect(destination(loaded.teamId, loaded.eventId));
}
