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
import {
  copyPracticePlan,
  createSupabasePracticePlannerGateway,
  savePracticeDrill,
  savePracticePlan,
} from "@stable/practice-planner";
import type { PracticePlanDraft } from "@stable/practice-planner";

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

function practicePlannerFailure(caught: unknown): string {
  if (!(caught instanceof ApplicationError)) return trainingMessages.saveFailed;
  switch (caught.code) {
    case "UNAUTHENTICATED":
      return trainingMessages.unauthenticated;
    case "FORBIDDEN":
      return trainingMessages.forbidden;
    case "NOT_FOUND":
      return trainingMessages.notFound;
    case "VALIDATION_FAILED":
      return trainingMessages.validationFailed;
    case "CONFLICT":
      return trainingMessages.conflict;
    default:
      return trainingMessages.saveFailed;
  }
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

function integerValues(formData: FormData, key: string): number[] | null {
  const values = formData.getAll(key);
  const parsed = values.map((value) =>
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN,
  );
  return parsed.some((value) => !Number.isSafeInteger(value)) ? null : parsed;
}

function textValues(formData: FormData, key: string): string[] | null {
  const values = formData.getAll(key);
  return values.every((value) => typeof value === "string")
    ? (values as string[])
    : null;
}

export async function savePracticePlanAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const eventValue = formData.get("trainingEventId");
  const planValue = formData.get("planId");
  const title = formData.get("title");
  const notes = formData.get("notes");
  const orders = integerValues(formData, "order");
  const minutes = integerValues(formData, "durationMinutes");
  const blockIds = textValues(formData, "blockId");
  const drillIds = textValues(formData, "drillId");
  const titles = textValues(formData, "blockTitle");
  const instructions = textValues(formData, "instructions");
  const eventId =
    typeof eventValue === "string" && eventValue !== "" ? eventValue : null;
  const planId =
    typeof planValue === "string" && planValue !== "" ? planValue : null;
  const path = teamId !== null && UUID.test(teamId) ? destination(teamId) : "/";
  if (
    clubId === null ||
    teamId === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId) ||
    (eventId !== null && !UUID.test(eventId)) ||
    (planId !== null && !UUID.test(planId)) ||
    typeof title !== "string" ||
    typeof notes !== "string" ||
    orders === null ||
    minutes === null ||
    blockIds === null ||
    drillIds === null ||
    titles === null ||
    instructions === null ||
    ![
      orders.length,
      minutes.length,
      blockIds.length,
      drillIds.length,
      titles.length,
      instructions.length,
    ].every((n) => n === orders.length)
  )
    redirect(withError(path, trainingMessages.validationFailed));

  const blocks: PracticePlanDraft["blocks"] = [];
  for (let index = 0; index < orders.length; index += 1) {
    const rawDrill = drillIds[index]?.trim() ?? "";
    const rawTitle = titles[index]?.trim() ?? "";
    if (rawDrill === "" && rawTitle === "") continue;
    if (rawDrill !== "" && !UUID.test(rawDrill))
      redirect(withError(path, trainingMessages.validationFailed));
    const rawBlockId = blockIds[index]?.trim() ?? "";
    const order = orders[index];
    const durationMinutes = minutes[index];
    if (rawBlockId !== "" && !UUID.test(rawBlockId))
      redirect(withError(path, trainingMessages.validationFailed));
    if (order === undefined || durationMinutes === undefined)
      redirect(withError(path, trainingMessages.validationFailed));
    blocks.push({
      blockId: rawBlockId === "" ? null : rawBlockId,
      order,
      durationMinutes,
      drillId: rawDrill === "" ? null : rawDrill,
      title: rawTitle === "" ? null : rawTitle,
      instructions: instructions[index] ?? "",
    });
  }
  const focus = formData.getAll("focusRef").flatMap((value) => {
    if (typeof value !== "string") return [];
    const [sourceReviewId, sourceEventId, code, extra] = value.split("|");
    if (!sourceReviewId || !sourceEventId || !code || extra !== undefined)
      return [];
    return [{ sourceReviewId, sourceEventId, code }];
  }) as PracticePlanDraft["focus"];
  const loaded = await loadAccess(clubId, teamId);
  if (loaded === null)
    redirect(withError(path, trainingMessages.unauthenticated));
  try {
    await savePracticePlan({
      ...loaded.access,
      clubId,
      teamId,
      draft: { planId, trainingEventId: eventId, title, notes, blocks, focus },
      writer: createSupabasePracticePlannerGateway(loaded.supabase, teamId),
    });
  } catch (caught: unknown) {
    const message = practicePlannerFailure(caught);
    redirect(withError(path, message));
  }
  redirect(path);
}

export async function copyPracticePlanAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const sourcePlanId = text(formData, "sourcePlanId");
  const eventValue = formData.get("trainingEventId");
  const templateValue = formData.get("asTemplate");
  const eventId =
    typeof eventValue === "string" && eventValue !== "" ? eventValue : null;
  const asTemplate =
    templateValue === "true" || (eventId === null && templateValue !== "false");
  const path = teamId !== null && UUID.test(teamId) ? destination(teamId) : "/";
  if (
    clubId === null ||
    teamId === null ||
    sourcePlanId === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId) ||
    !UUID.test(sourcePlanId) ||
    (eventId !== null && !UUID.test(eventId))
  ) {
    redirect(withError(path, trainingMessages.validationFailed));
  }
  const loaded = await loadAccess(clubId, teamId);
  if (loaded === null)
    redirect(withError(path, trainingMessages.unauthenticated));
  try {
    await copyPracticePlan({
      ...loaded.access,
      clubId,
      teamId,
      sourcePlanId,
      trainingEventId: eventId,
      asTemplate,
      writer: createSupabasePracticePlannerGateway(loaded.supabase, teamId),
    });
  } catch (caught: unknown) {
    const message = practicePlannerFailure(caught);
    redirect(withError(path, message));
  }
  redirect(path);
}

export async function savePracticeDrillAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const name = formData.get("drillName");
  const instructions = formData.get("drillInstructions");
  const rawDuration = text(formData, "drillMinutes");
  const defaultDurationMinutes =
    rawDuration === null
      ? null
      : /^\d+$/.test(rawDuration)
        ? Number(rawDuration)
        : NaN;
  const path = teamId !== null && UUID.test(teamId) ? destination(teamId) : "/";
  if (
    clubId === null ||
    teamId === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId) ||
    typeof name !== "string" ||
    typeof instructions !== "string" ||
    (defaultDurationMinutes !== null &&
      !Number.isSafeInteger(defaultDurationMinutes))
  ) {
    redirect(withError(path, trainingMessages.validationFailed));
  }
  const loaded = await loadAccess(clubId, teamId);
  if (loaded === null)
    redirect(withError(path, trainingMessages.unauthenticated));
  try {
    await savePracticeDrill({
      ...loaded.access,
      clubId,
      teamId,
      name,
      instructions,
      defaultDurationMinutes,
      writer: createSupabasePracticePlannerGateway(loaded.supabase, teamId),
    });
  } catch (caught: unknown) {
    const message = practicePlannerFailure(caught);
    redirect(withError(path, message));
  }
  redirect(path);
}
