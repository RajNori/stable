import { ApplicationError } from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";
import {
  createSupabaseFixtureGateway,
  fixtureMessages,
  utcIsoToLocalDateTime,
} from "@stable/fixtures";

import { ClubAdminShell } from "../../../../components/club-admin-shell";
import { FixturesPanel } from "../../../../components/fixtures-panel";
import { loadLiveClubContext } from "../../../../lib/load-live-club-context";
import { principalFromSupabase } from "../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  createFixtureAction,
  fixturePageCapabilities,
  updateFixtureOverlayAction,
  updateOfficialFixtureAction,
} from "./actions";

export const dynamic = "force-dynamic";

type FixturesPageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamFixturesPage({
  params,
  searchParams,
}: FixturesPageProps) {
  const { teamId } = await params;
  const query = await searchParams;
  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return <ClubAdminShell presentation={presentation} />;
  }

  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  const reader = await createRuntimeClubContextReader(supabase);
  const context = await getCurrentClubContext({ principal, reader });
  const club = context.club;
  if (club === null) {
    return <ClubAdminShell presentation={presentation} />;
  }

  const gateway = createSupabaseFixtureGateway(supabase);
  const team = await gateway.readVisibleTeam(teamId);
  if (team === null || team.clubId !== club.id) {
    return (
      <ClubAdminShell presentation={presentation}>
        <p role="alert">{fixtureMessages.notFound}</p>
      </ClubAdminShell>
    );
  }

  let fixtures: Awaited<ReturnType<typeof gateway.listTeamFixtures>> = [];
  let loadError: string | undefined;
  try {
    fixtures = await gateway.listTeamFixtures(team.id);
  } catch (error: unknown) {
    loadError =
      error instanceof ApplicationError
        ? error.message
        : fixtureMessages.readFailed;
  }

  const capabilities = await fixturePageCapabilities(
    club.id,
    team.id,
    team.active,
  );
  const error = allowedFixtureError(query["error"]) ?? loadError;

  return (
    <ClubAdminShell presentation={presentation}>
      <FixturesPanel
        clubId={club.id}
        teamId={team.id}
        teamName={team.name}
        fixtures={fixtures.map((fixture) => ({
          eventId: fixture.eventId,
          opponentName: fixture.opponentName,
          roundLabel: fixture.roundLabel,
          officialStartLocal: utcIsoToLocalDateTime(
            fixture.officialStartAt,
            club.timezone,
          ),
          arrivalLocal:
            fixture.arrivalAt === null
              ? ""
              : utcIsoToLocalDateTime(fixture.arrivalAt, club.timezone),
          uniformNote: fixture.uniformNote,
          coachFocus: fixture.coachFocus,
          teamNote: fixture.teamNote,
          fixtureStatus: fixture.fixtureStatus,
        }))}
        canManageOfficial={capabilities.official}
        canManageOverlay={capabilities.overlay}
        createAction={createFixtureAction}
        officialAction={updateOfficialFixtureAction}
        overlayAction={updateFixtureOverlayAction}
        error={error}
      />
    </ClubAdminShell>
  );
}

function allowedFixtureError(
  value: string | string[] | undefined,
): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return Object.values(fixtureMessages).find(
    (message) => message === candidate,
  );
}
