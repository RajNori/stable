import { ApplicationError } from "@stable/contracts";
import {
  createSupabaseRosterGateway,
  listTeamRoster,
  rosterMessages,
} from "@stable/roster";

import { ClubAdminShell } from "../../../../components/club-admin-shell";
import { RosterPanel } from "../../../../components/roster-panel";
import { loadRosterRequest } from "../../../../lib/load-roster-facts";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  registerRosterPlayerAction,
  unregisterRosterPlayerAction,
} from "./actions";

export const dynamic = "force-dynamic";

type RosterPageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamRosterPage({
  params,
  searchParams,
}: RosterPageProps) {
  const { teamId } = await params;
  const query = await searchParams;
  const error = allowedRosterError(query["error"]);
  const loaded = await loadRosterRequest(teamId);
  if (loaded.presentation.status !== "member" || loaded.facts === null) {
    return (
      <ClubAdminShell presentation={loaded.presentation}>
        {loaded.presentation.status === "member" ? (
          <p role="alert">{rosterMessages.notFound}</p>
        ) : null}
      </ClubAdminShell>
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const roster = await listTeamRoster({
      ...loaded.facts,
      reader: createSupabaseRosterGateway(supabase),
    });
    return (
      <ClubAdminShell presentation={loaded.presentation}>
        <RosterPanel
          clubId={loaded.facts.clubId}
          teamName={loaded.teamName ?? "Team"}
          roster={roster}
          error={error}
          registerPlayer={registerRosterPlayerAction}
          unregisterPlayer={unregisterRosterPlayerAction}
        />
      </ClubAdminShell>
    );
  } catch (caught: unknown) {
    const message =
      caught instanceof ApplicationError
        ? caught.message
        : rosterMessages.readFailed;
    return (
      <ClubAdminShell presentation={loaded.presentation}>
        <p role="alert">
          {allowedRosterError(message) ?? rosterMessages.forbidden}
        </p>
      </ClubAdminShell>
    );
  }
}

function allowedRosterError(
  value: string | string[] | undefined,
): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined) {
    return undefined;
  }
  const allowed: readonly string[] = Object.values(rosterMessages);
  return allowed.includes(text) ? text : undefined;
}
