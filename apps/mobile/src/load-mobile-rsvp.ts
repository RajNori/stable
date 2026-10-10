import { principalFromSession } from "@stable/auth";
import { ApplicationError } from "@stable/contracts";
import {
  createSupabaseAttendanceGateway,
  listManagedAttendance,
  recordAttendance,
} from "@stable/attendance";
import type { ManagedAttendance } from "@stable/attendance";
import { evaluateCapability } from "@stable/permissions";
import { createSupabaseRosterGateway, listTeamRoster } from "@stable/roster";
import type { User } from "@supabase/supabase-js";

import { getMobileSupabaseClient } from "./supabase-client";
import { createMobileClubContextReader } from "./supabase-reader";

export type MobileRsvpChoice = Omit<ManagedAttendance, "status"> & {
  name: string;
  status: ManagedAttendance["status"] | "UNANSWERED";
};

type RsvpStatus = "ATTENDING" | "UNAVAILABLE" | "UNSURE";

function sessionIdentity(user: User | undefined) {
  if (user === undefined) return null;
  const value = Object.getOwnPropertyDescriptor(
    user.user_metadata,
    "display_name",
  )?.value;
  return {
    id: user.id,
    ...(typeof value === "string" && value.length > 0
      ? { displayName: value }
      : {}),
  };
}

async function accessFor(teamId: string) {
  const client = getMobileSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error !== null) throw new Error("The session could not be read.");
  const principal = principalFromSession(sessionIdentity(data.session?.user));
  if (principal === null)
    throw new ApplicationError("UNAUTHENTICATED", "Sign in to continue.");

  const read = await createMobileClubContextReader(client).read(
    principal.userId,
  );
  const team = read.teams.find((item) => item.id === teamId);
  if (team === undefined || !team.active) {
    throw new ApplicationError("FORBIDDEN", "This Game Day is not available.");
  }
  return {
    client,
    team,
    principal,
    access: {
      principal,
      clubMemberships: read.memberships,
      teamMemberships: read.teamMemberships,
      guardianLinks: read.guardianLinks,
      registrations: read.registrations,
      teamActive: true,
    },
  };
}

export async function loadMobileRsvpChoices(
  teamId: string,
  eventId: string,
): Promise<readonly MobileRsvpChoice[]> {
  const { client, team, access } = await accessFor(teamId);
  const writer = createSupabaseAttendanceGateway(client);
  const [saved, roster] = await Promise.all([
    listManagedAttendance({
      ...access,
      clubId: team.clubId,
      teamId,
      eventId,
      writer,
    }),
    listTeamRoster({
      ...access,
      clubId: team.clubId,
      teamId,
      teamActive: true,
      reader: createSupabaseRosterGateway(client),
    }),
  ]);
  const savedByPlayer = new Map(
    saved.map((item) => [item.playerId, item.status]),
  );
  const eligible = new Set<string>();
  for (const link of access.guardianLinks) {
    if (!link.active || !link.playerActive || link.clubId !== team.clubId)
      continue;
    const registered = access.registrations.some(
      (item) =>
        item.active &&
        item.teamActive &&
        item.clubId === team.clubId &&
        item.teamId === teamId &&
        item.playerId === link.playerId,
    );
    if (!registered) continue;
    const allowed =
      evaluateCapability({
        ...access,
        resource: {
          clubId: team.clubId,
          teamId,
          teamActive: true,
          playerId: link.playerId,
        },
        capability: "attendance.manage_managed_player",
      }) === "allow";
    if (allowed) eligible.add(link.playerId);
  }
  const entries = roster.entries.filter((entry) =>
    eligible.has(entry.playerId),
  );
  const nameCounts = new Map<string, number>();
  for (const entry of entries) {
    nameCounts.set(entry.name, (nameCounts.get(entry.name) ?? 0) + 1);
  }
  const seenNames = new Map<string, number>();
  return entries.map((entry) => {
    const seen = (seenNames.get(entry.name) ?? 0) + 1;
    seenNames.set(entry.name, seen);
    return {
      playerId: entry.playerId,
      name:
        (nameCounts.get(entry.name) ?? 0) > 1
          ? `${entry.name} — Player ${seen}`
          : entry.name,
      status: savedByPlayer.get(entry.playerId) ?? "UNANSWERED",
    };
  });
}

export async function saveMobileRsvp(input: {
  teamId: string;
  eventId: string;
  playerId: string;
  status: RsvpStatus;
}): Promise<void> {
  const { client, team, access } = await accessFor(input.teamId);
  await recordAttendance({
    ...access,
    clubId: team.clubId,
    teamId: input.teamId,
    eventId: input.eventId,
    playerId: input.playerId,
    status: input.status,
    absenceCategory: null,
    privateNote: null,
    writer: createSupabaseAttendanceGateway(client),
  });
}
