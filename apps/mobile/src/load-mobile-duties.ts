import { principalFromSession } from "@stable/auth";
import { ApplicationError } from "@stable/contracts";
import {
  acknowledgeGameDuty,
  acceptDutySwap,
  createSupabaseGameDayGateway,
  listOpenDutySwaps,
  requestDutySwap,
} from "@stable/game-day";
import type { DutySwapRecord } from "@stable/game-day";
import type { User } from "@supabase/supabase-js";

import { getMobileSupabaseClient } from "./supabase-client";
import { createMobileClubContextReader } from "./supabase-reader";

function principalFor(user: User | undefined) {
  if (user === undefined) return null;
  const value = Object.getOwnPropertyDescriptor(
    user.user_metadata,
    "display_name",
  )?.value;
  return principalFromSession({
    id: user.id,
    ...(typeof value === "string" && value.length > 0
      ? { displayName: value }
      : {}),
  });
}

async function dutyAccess(teamId: string) {
  const client = getMobileSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error !== null) throw new Error("The session could not be read.");
  const principal = principalFor(data.session?.user);
  if (principal === null) {
    throw new ApplicationError("UNAUTHENTICATED", "Sign in to continue.");
  }
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

export async function loadMobileOpenDutySwaps(input: {
  teamId: string;
  eventId: string;
}): Promise<readonly DutySwapRecord[]> {
  const { client, team, access } = await dutyAccess(input.teamId);
  const swaps = await listOpenDutySwaps({
    ...access,
    clubId: team.clubId,
    teamId: input.teamId,
    eventId: input.eventId,
    writer: createSupabaseGameDayGateway(client),
  });
  return swaps.filter(
    (swap) => swap.requesterUserId !== access.principal?.userId,
  );
}

export async function acknowledgeMobileDuty(input: {
  teamId: string;
  eventId: string;
}): Promise<number> {
  const { client, team, access } = await dutyAccess(input.teamId);
  return acknowledgeGameDuty({
    ...access,
    clubId: team.clubId,
    teamId: input.teamId,
    eventId: input.eventId,
    writer: createSupabaseGameDayGateway(client),
  });
}

export async function requestMobileOpenDutySwap(input: {
  teamId: string;
  eventId: string;
}): Promise<{ requestId: string }> {
  const { client, team, access } = await dutyAccess(input.teamId);
  return requestDutySwap({
    ...access,
    clubId: team.clubId,
    teamId: input.teamId,
    eventId: input.eventId,
    targetUserId: null,
    writer: createSupabaseGameDayGateway(client),
  });
}

export async function acceptMobileDutySwap(input: {
  teamId: string;
  requestId: string;
}): Promise<{ requestId: string }> {
  const { client, team, access } = await dutyAccess(input.teamId);
  return acceptDutySwap({
    ...access,
    clubId: team.clubId,
    teamId: input.teamId,
    requestId: input.requestId,
    writer: createSupabaseGameDayGateway(client),
  });
}
