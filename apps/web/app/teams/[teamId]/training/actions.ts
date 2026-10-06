"use server";

import { ApplicationError } from "@stable/contracts";
import { localDateTimeToUtcIso } from "@stable/fixtures";
import {
  checkInTraining,
  createSupabaseTrainingGateway,
  createTrainingSeries,
  createTrainingSession,
  trainingMessages,
} from "@stable/training";
import { redirect } from "next/navigation";

import { fixtureAccessFrom } from "../../../../lib/fixture-access";
import { principalFromSupabase } from "../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function destination(teamId: string): string {
  return `/teams/${teamId}/training`;
}

function withError(path: string, message: string): string {
  return `${path}?error=${encodeURIComponent(message)}`;
}

async function loadAccess(clubId: string, teamId: string) {
  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  const reader = await createRuntimeClubContextReader(supabase);
  const facts = principal === null ? null : await reader.read(principal.userId);
  const team = facts?.teams.find((item) => item.id === teamId);
  if (
    principal === null ||
    facts === null ||
    team === undefined ||
    team.clubId !== clubId
  ) {
    return null;
  }
  return {
    supabase,
    access: fixtureAccessFrom(principal, facts, team.active),
    timezone:
      facts.clubs.find((club) => club.id === clubId)?.timezone ??
      "Australia/Melbourne",
  };
}

export async function createTrainingSessionAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const starts = text(formData, "startsAt");
  if (
    clubId === null ||
    teamId === null ||
    starts === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId)
  ) {
    redirect(
      teamId !== null && UUID.test(teamId)
        ? withError(destination(teamId), trainingMessages.validationFailed)
        : "/",
    );
  }

  const loaded = await loadAccess(clubId, teamId);
  if (loaded === null) {
    redirect(withError(destination(teamId), trainingMessages.unauthenticated));
  }

  try {
    await createTrainingSession({
      ...loaded.access,
      clubId,
      teamId,
      startsAt: localDateTimeToUtcIso(starts, loaded.timezone),
      endsAt: null,
      courtLabel: text(formData, "courtLabel"),
      leadCoachUserId: null,
      writer: createSupabaseTrainingGateway(loaded.supabase),
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof ApplicationError
        ? caught.message
        : trainingMessages.saveFailed;
    redirect(withError(destination(teamId), message));
  }
  redirect(destination(teamId));
}

export async function createTrainingSeriesAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const weekday = Number(text(formData, "weekday"));
  const localTime = text(formData, "localTime");
  const startsOn = text(formData, "startsOn");
  if (
    clubId === null ||
    teamId === null ||
    localTime === null ||
    startsOn === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId) ||
    !Number.isInteger(weekday)
  ) {
    redirect(
      teamId !== null && UUID.test(teamId)
        ? withError(destination(teamId), trainingMessages.validationFailed)
        : "/",
    );
  }

  const loaded = await loadAccess(clubId, teamId);
  if (loaded === null) {
    redirect(withError(destination(teamId), trainingMessages.unauthenticated));
  }

  try {
    await createTrainingSeries({
      ...loaded.access,
      clubId,
      teamId,
      weekday,
      localTime,
      timezone: loaded.timezone,
      startsOn,
      endsOn: text(formData, "endsOn"),
      courtLabel: text(formData, "courtLabel"),
      leadCoachUserId: null,
      writer: createSupabaseTrainingGateway(loaded.supabase),
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof ApplicationError
        ? caught.message
        : trainingMessages.saveFailed;
    redirect(withError(destination(teamId), message));
  }
  redirect(destination(teamId));
}

export async function checkInTrainingAction(formData: FormData): Promise<void> {
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
      teamId !== null && UUID.test(teamId)
        ? withError(destination(teamId), trainingMessages.validationFailed)
        : "/",
    );
  }

  const loaded = await loadAccess(clubId, teamId);
  if (loaded === null) {
    redirect(withError(destination(teamId), trainingMessages.unauthenticated));
  }

  try {
    await checkInTraining({
      ...loaded.access,
      clubId,
      teamId,
      eventId,
      writer: createSupabaseTrainingGateway(loaded.supabase),
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof ApplicationError
        ? caught.message
        : trainingMessages.saveFailed;
    redirect(withError(destination(teamId), message));
  }
  redirect(destination(teamId));
}
