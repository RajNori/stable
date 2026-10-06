import { principalFromSession } from "@stable/auth";
import { ApplicationError } from "@stable/contracts";
import type { TeamRoster } from "@stable/roster";
import {
  createSupabaseRosterGateway,
  listTeamRoster,
  rosterMessages,
} from "@stable/roster";
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

export async function loadMobileTeamRoster(
  teamId: string,
): Promise<TeamRoster> {
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
      rosterMessages.unauthenticated,
    );
  }

  const read = await createMobileClubContextReader(client).read(
    principal.userId,
  );
  const team = read.teams.find((item) => item.id === teamId);

  return listTeamRoster({
    principal,
    clubMemberships: read.memberships,
    teamMemberships: read.teamMemberships,
    guardianLinks: read.guardianLinks,
    registrations: read.registrations,
    clubId: team?.clubId ?? read.clubs[0]?.id ?? teamId,
    teamId,
    teamActive: team?.active === true,
    reader: createSupabaseRosterGateway(client),
  });
}
