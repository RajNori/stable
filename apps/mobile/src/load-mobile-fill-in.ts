import { principalFromSession } from "@stable/auth";
import { ApplicationError } from "@stable/contracts";
import {
  createSupabaseFillInGateway,
  listGuardianFillInPlayers,
  respondFillIn,
} from "@stable/fill-ins";
import type {
  FillInAccess,
  FillInCandidate,
  FillInRequest,
} from "@stable/fill-ins";
import type { User } from "@supabase/supabase-js";

import { getMobileSupabaseClient } from "./supabase-client";
import { createMobileClubContextReader } from "./supabase-reader";

export type MobileFillInProjection = {
  request: FillInRequest | null;
  players: readonly FillInCandidate[];
};

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

async function fillInAccess(teamId: string): Promise<{
  client: ReturnType<typeof getMobileSupabaseClient>;
  access: FillInAccess;
}> {
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

export async function loadMobileFillIn(
  teamId: string,
  eventId: string,
): Promise<MobileFillInProjection> {
  const { client, access } = await fillInAccess(teamId);
  const writer = createSupabaseFillInGateway(client);
  const request = await writer.listEventFillIn(eventId);
  if (request === null) return { request: null, players: [] };
  const players = await listGuardianFillInPlayers({
    ...access,
    teamId,
    writer,
  });
  return { request, players };
}

export async function respondMobileFillIn(input: {
  teamId: string;
  requestId: string;
  playerId: string;
}): Promise<void> {
  const { client, access } = await fillInAccess(input.teamId);
  await respondFillIn({
    ...access,
    requestId: input.requestId,
    playerId: input.playerId,
    writer: createSupabaseFillInGateway(client),
  });
}
