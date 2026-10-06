import { principalFromSession } from "@stable/auth";
import { ApplicationError } from "@stable/contracts";
import {
  agendaRange,
  createSupabaseScheduleGateway,
  listTeamSchedule,
  scheduleMessages,
} from "@stable/schedule";
import type { ScheduleEntry } from "@stable/schedule";
import type { User } from "@supabase/supabase-js";

import { getMobileSupabaseClient } from "./supabase-client";
import { createMobileClubContextReader } from "./supabase-reader";

function readDisplayName(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }

  const value = Object.getOwnPropertyDescriptor(
    metadata,
    "display_name",
  )?.value;
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

function sessionIdentityFromUser(user: User): {
  id: string;
  displayName?: string;
} {
  const displayName = readDisplayName(user.user_metadata);
  if (displayName === undefined) {
    return { id: user.id };
  }

  return { id: user.id, displayName };
}

export async function loadMobileTeamSchedule(
  teamId: string,
): Promise<ScheduleEntry[]> {
  const client = getMobileSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error !== null) {
    throw new Error("The session could not be read.");
  }

  const user = data.session?.user;
  const principal = principalFromSession(
    user === undefined ? null : sessionIdentityFromUser(user),
  );
  if (principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      scheduleMessages.unauthenticated,
    );
  }

  const read = await createMobileClubContextReader(client).read(
    principal.userId,
  );
  const team = read.teams.find((item) => item.id === teamId);
  const range = agendaRange(new Date());

  return listTeamSchedule({
    principal,
    clubMemberships: read.memberships.map((membership) => ({
      clubId: membership.clubId,
      role: membership.role,
      active: membership.active,
    })),
    teamMemberships: read.teamMemberships,
    guardianLinks: read.guardianLinks,
    registrations: read.registrations,
    teamActive: team?.active === true,
    clubId: team?.clubId ?? read.clubs[0]?.id ?? teamId,
    teamId,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
    eventType: null,
    reader: createSupabaseScheduleGateway(client),
  });
}
