"use server";

import { ApplicationError } from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";
import {
  createManualFixture,
  createSupabaseFixtureGateway,
  fixtureMessages,
  HOME_AWAY,
  importFixture,
  localDateTimeToUtcIso,
  updateFixtureOverlay,
  updateOfficialFixture,
} from "@stable/fixtures";
import type { OfficialFixture } from "@stable/fixtures";
import { redirect } from "next/navigation";

import { fixtureAccessFrom } from "../../../../lib/fixture-access";
import { principalFromSupabase } from "../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createFixtureAction(formData: FormData): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const destination = fixturePath(teamId);
  const opponentName = text(formData, "opponentName");
  const officialStart = text(formData, "officialStart");
  if (
    clubId === null ||
    teamId === null ||
    opponentName === null ||
    officialStart === null
  ) {
    redirect(withError(destination, fixtureMessages.validationFailed));
  }

  const loaded = await loadFixtureContext(clubId, teamId);
  if ("error" in loaded) {
    redirect(withError(destination, loaded.error));
  }

  let startsAt: string;
  let endsAt: string | null;
  try {
    startsAt = localDateTimeToUtcIso(officialStart, loaded.timeZone);
    const ends = text(formData, "endsAt");
    endsAt =
      ends === null ? null : localDateTimeToUtcIso(ends, loaded.timeZone);
  } catch (error: unknown) {
    redirect(withError(destination, actionMessage(error)));
  }

  const court = optionalText(formData, "courtLabel");
  const command: OfficialFixture = {
    clubId,
    teamId,
    startsAt,
    endsAt,
    venueId: null,
    courtLabel: court,
    competitionId: null,
    roundLabel: optionalText(formData, "roundLabel"),
    opponentName,
    officialStartAt: startsAt,
    officialVenueText: optionalText(formData, "officialVenueText"),
    officialCourtLabel: court,
    homeAway: homeAwayFrom(formData.get("homeAway")),
  };
  const externalId = optionalText(formData, "externalId");
  const gateway = loaded.gateway;

  try {
    if (externalId === null) {
      await createManualFixture({
        ...loaded.access,
        ...command,
        writer: gateway,
      });
    } else {
      await importFixture({
        ...loaded.access,
        ...command,
        externalId,
        writer: gateway,
      });
    }
  } catch (error: unknown) {
    redirect(withError(destination, actionMessage(error)));
  }

  redirect(destination);
}

export async function updateOfficialFixtureAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const eventId = text(formData, "eventId");
  const destination = fixturePath(teamId);
  const opponentName = text(formData, "opponentName");
  const officialStart = text(formData, "officialStart");
  const fixtureStatus = text(formData, "fixtureStatus");
  if (
    clubId === null ||
    teamId === null ||
    eventId === null ||
    opponentName === null ||
    officialStart === null ||
    fixtureStatus === null
  ) {
    redirect(withError(destination, fixtureMessages.validationFailed));
  }

  const loaded = await loadFixtureContext(clubId, teamId);
  if ("error" in loaded) {
    redirect(withError(destination, loaded.error));
  }

  let startsAt: string;
  try {
    startsAt = localDateTimeToUtcIso(officialStart, loaded.timeZone);
  } catch (error: unknown) {
    redirect(withError(destination, actionMessage(error)));
  }

  const court = optionalText(formData, "courtLabel");
  try {
    await updateOfficialFixture({
      ...loaded.access,
      clubId,
      teamId,
      eventId,
      startsAt,
      endsAt: null,
      venueId: null,
      courtLabel: court,
      competitionId: null,
      roundLabel: optionalText(formData, "roundLabel"),
      opponentName,
      officialStartAt: startsAt,
      officialVenueText: optionalText(formData, "officialVenueText"),
      officialCourtLabel: court,
      homeAway: homeAwayFrom(formData.get("homeAway")),
      fixtureStatus:
        fixtureStatus === "POSTPONED" ||
        fixtureStatus === "CANCELLED" ||
        fixtureStatus === "COMPLETED" ||
        fixtureStatus === "SCHEDULED"
          ? fixtureStatus
          : "SCHEDULED",
      teamScore: null,
      opponentScore: null,
      resultStatus: null,
      writer: loaded.gateway,
    });
  } catch (error: unknown) {
    redirect(withError(destination, actionMessage(error)));
  }

  redirect(destination);
}

export async function updateFixtureOverlayAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const eventId = text(formData, "eventId");
  const destination = fixturePath(teamId);
  if (clubId === null || teamId === null || eventId === null) {
    redirect(withError(destination, fixtureMessages.validationFailed));
  }

  const loaded = await loadFixtureContext(clubId, teamId);
  if ("error" in loaded) {
    redirect(withError(destination, loaded.error));
  }

  let arrivalAt: string | null;
  try {
    const arrival = text(formData, "arrivalAt");
    arrivalAt =
      arrival === null ? null : localDateTimeToUtcIso(arrival, loaded.timeZone);
  } catch (error: unknown) {
    redirect(withError(destination, actionMessage(error)));
  }

  try {
    await updateFixtureOverlay({
      ...loaded.access,
      clubId,
      teamId,
      eventId,
      arrivalAt,
      uniformNote: optionalText(formData, "uniformNote"),
      coachFocus: optionalText(formData, "coachFocus"),
      teamNote: optionalText(formData, "teamNote"),
      writer: loaded.gateway,
    });
  } catch (error: unknown) {
    redirect(withError(destination, actionMessage(error)));
  }

  redirect(destination);
}

async function loadFixtureContext(
  clubId: string,
  teamId: string,
): Promise<
  | {
      access: ReturnType<typeof fixtureAccessFrom>;
      timeZone: string;
      gateway: ReturnType<typeof createSupabaseFixtureGateway>;
    }
  | { error: string }
> {
  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  if (principal === null) {
    return { error: fixtureMessages.unauthenticated };
  }

  try {
    const reader = await createRuntimeClubContextReader(supabase);
    const facts = await reader.read(principal.userId);
    const gateway = createSupabaseFixtureGateway(supabase);
    const team = await gateway.readVisibleTeam(teamId);
    if (team === null || team.clubId !== clubId) {
      return { error: fixtureMessages.notFound };
    }
    const club = facts.clubs.find((item) => item.id === clubId);
    if (club === undefined) {
      return { error: fixtureMessages.notFound };
    }
    return {
      access: fixtureAccessFrom(principal, facts, team.active),
      timeZone: club.timezone,
      gateway,
    };
  } catch (error: unknown) {
    return { error: actionMessage(error) };
  }
}

function fixturePath(teamId: string | null): string {
  if (teamId !== null && UUID.test(teamId)) {
    return `/teams/${teamId}/fixtures`;
  }
  return "/";
}

function withError(path: string, message: string): string {
  return `${path}?error=${encodeURIComponent(message)}`;
}

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key);
}

function homeAwayFrom(
  value: FormDataEntryValue | null,
): OfficialFixture["homeAway"] {
  if (typeof value !== "string") {
    return null;
  }
  return HOME_AWAY.find((item) => item === value) ?? null;
}

function actionMessage(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }
  return fixtureMessages.saveFailed;
}

export async function fixturePageCapabilities(
  clubId: string,
  teamId: string,
  teamActive: boolean,
): Promise<{ official: boolean; overlay: boolean }> {
  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  if (principal === null) {
    return { official: false, overlay: false };
  }
  const reader = await createRuntimeClubContextReader(supabase);
  const facts = await reader.read(principal.userId);
  const access = fixtureAccessFrom(principal, facts, teamActive);
  const resource = { clubId, teamId, teamActive };
  const factsForDecision = {
    clubMemberships: access.clubMemberships,
    teamMemberships: access.teamMemberships,
    guardianLinks: access.guardianLinks,
    registrations: access.registrations,
    resource,
  };
  return {
    official:
      evaluateCapability({
        ...factsForDecision,
        capability: "fixture.manage_manual",
      }) === "allow",
    overlay:
      evaluateCapability({
        ...factsForDecision,
        capability: "fixture.overlay_manage",
      }) === "allow",
  };
}
