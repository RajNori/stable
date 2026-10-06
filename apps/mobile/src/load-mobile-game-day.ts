import { principalFromSession } from "@stable/auth";
import { ApplicationError } from "@stable/contracts";
import {
  createSupabaseGameDayGateway,
  gameDayMessages,
  readGameDay,
} from "@stable/game-day";
import type { GameDayProjection } from "@stable/game-day";
import {
  agendaRange,
  createSupabaseScheduleGateway,
  listTeamSchedule,
} from "@stable/schedule";
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

export async function loadMobileGameDay(
  teamId: string,
): Promise<GameDayProjection | null> {
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
      gameDayMessages.unauthenticated,
    );
  }

  const read = await createMobileClubContextReader(client).read(
    principal.userId,
  );
  const team = read.teams.find((item) => item.id === teamId);
  const access = {
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
  };
  const clubId = team?.clubId ?? read.clubs[0]?.id ?? teamId;
  const range = agendaRange(new Date());
  const agenda = await listTeamSchedule({
    ...access,
    clubId,
    teamId,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
    eventType: "GAME",
    reader: createSupabaseScheduleGateway(client),
  });
  const nextGame = agenda[0];
  if (nextGame === undefined) {
    return null;
  }

  return readGameDay({
    ...access,
    clubId,
    teamId,
    eventId: nextGame.eventId,
    reader: createSupabaseGameDayGateway(client),
  });
}
