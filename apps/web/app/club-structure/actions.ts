"use server";

import { ApplicationError } from "@stable/contracts";
import {
  clubStructureMessages,
  createCompetition,
  createSeasonAndTeam,
  createTeam,
  createVenue,
  createSupabaseClubStructureGateway,
  updateCompetition,
  updateSeason,
  updateTeam,
  updateVenue,
} from "@stable/club-structure";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";

export async function createSeasonAndTeamAction(
  formData: FormData,
): Promise<void> {
  const seasonName = formData.get("seasonName");
  const teamName = formData.get("teamName");
  const clubId = formData.get("clubId");
  if (
    typeof seasonName !== "string" ||
    typeof teamName !== "string" ||
    typeof clubId !== "string"
  ) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }

  const supabase = await createSupabaseServerClient();
  const gateway = createSupabaseClubStructureGateway(supabase);

  try {
    const session = await gateway.readSession();
    await createSeasonAndTeam({
      principal: session.principal,
      memberships: session.memberships,
      clubId,
      seasonName,
      teamName,
      writer: gateway.writer,
    });
  } catch (error: unknown) {
    const message =
      error instanceof ApplicationError
        ? error.message
        : clubStructureMessages.saveFailed;
    redirect(structureErrorUrl(message));
  }

  redirect("/club-structure");
}

export async function createCompetitionAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const seasonId = text(formData, "seasonId");
  const name = text(formData, "name");
  if (clubId === null || seasonId === null || name === null) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }
  await runStructureCommand(() =>
    structureAccess().then(({ gateway, principal, memberships }) =>
      createCompetition({
        principal,
        memberships,
        clubId,
        seasonId,
        name,
        directory: gateway.directory,
        writer: gateway.writer,
      }),
    ),
  );
}

export async function createVenueAction(formData: FormData): Promise<void> {
  const clubId = text(formData, "clubId");
  const name = text(formData, "name");
  if (clubId === null || name === null) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }
  await runStructureCommand(() =>
    structureAccess().then(({ gateway, principal, memberships }) =>
      createVenue({
        principal,
        memberships,
        clubId,
        name,
        writer: gateway.writer,
      }),
    ),
  );
}

export async function createTeamAction(formData: FormData): Promise<void> {
  const clubId = text(formData, "clubId");
  const seasonId = text(formData, "seasonId");
  const name = text(formData, "name");
  const competitionValue = text(formData, "competitionId");
  const venueValue = text(formData, "venueId");
  if (
    clubId === null ||
    seasonId === null ||
    name === null ||
    competitionValue === null ||
    venueValue === null
  ) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }
  await runStructureCommand(() =>
    structureAccess().then(({ gateway, principal, memberships }) =>
      createTeam({
        principal,
        memberships,
        clubId,
        seasonId,
        competitionId: competitionValue.length === 0 ? null : competitionValue,
        venueId: venueValue.length === 0 ? null : venueValue,
        name,
        directory: gateway.directory,
        writer: gateway.writer,
      }),
    ),
  );
}

export async function updateSeasonAction(formData: FormData): Promise<void> {
  const seasonId = text(formData, "recordId");
  const name = text(formData, "name");
  const active = booleanValue(formData, "active");
  if (seasonId === null || name === null || active === null) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }
  await runStructureCommand(() =>
    structureAccess().then(({ gateway, principal, memberships }) =>
      updateSeason({
        principal,
        memberships,
        seasonId,
        name,
        active,
        directory: gateway.directory,
        writer: gateway.writer,
      }),
    ),
  );
}

export async function updateCompetitionAction(
  formData: FormData,
): Promise<void> {
  const competitionId = text(formData, "recordId");
  const name = text(formData, "name");
  const active = booleanValue(formData, "active");
  if (competitionId === null || name === null || active === null) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }
  await runStructureCommand(() =>
    structureAccess().then(({ gateway, principal, memberships }) =>
      updateCompetition({
        principal,
        memberships,
        competitionId,
        name,
        active,
        directory: gateway.directory,
        writer: gateway.writer,
      }),
    ),
  );
}

export async function updateVenueAction(formData: FormData): Promise<void> {
  const venueId = text(formData, "recordId");
  const name = text(formData, "name");
  const active = booleanValue(formData, "active");
  if (venueId === null || name === null || active === null) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }
  await runStructureCommand(() =>
    structureAccess().then(({ gateway, principal, memberships }) =>
      updateVenue({
        principal,
        memberships,
        venueId,
        name,
        active,
        directory: gateway.directory,
        writer: gateway.writer,
      }),
    ),
  );
}

export async function updateTeamAction(formData: FormData): Promise<void> {
  const teamId = text(formData, "recordId");
  const name = text(formData, "name");
  const active = booleanValue(formData, "active");
  if (teamId === null || name === null || active === null) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }
  await runStructureCommand(() =>
    structureAccess().then(({ gateway, principal, memberships }) =>
      updateTeam({
        principal,
        memberships,
        teamId,
        name,
        active,
        directory: gateway.directory,
        writer: gateway.writer,
      }),
    ),
  );
}

async function structureAccess() {
  const gateway = createSupabaseClubStructureGateway(
    await createSupabaseServerClient(),
  );
  const session = await gateway.readSession();
  return { gateway, ...session };
}

async function runStructureCommand(
  work: () => Promise<unknown>,
): Promise<void> {
  try {
    await work();
  } catch (error: unknown) {
    const message =
      error instanceof ApplicationError
        ? error.message
        : clubStructureMessages.saveFailed;
    redirect(structureErrorUrl(message));
  }
  redirect("/club-structure");
}

function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

function booleanValue(formData: FormData, name: string): boolean | null {
  const value = text(formData, name);
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function structureErrorUrl(message: string): string {
  return `/club-structure?error=${encodeURIComponent(message)}`;
}
