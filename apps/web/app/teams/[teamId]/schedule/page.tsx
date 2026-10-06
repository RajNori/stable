import { ApplicationError } from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";
import { createSupabaseFixtureGateway } from "@stable/fixtures";
import {
  agendaRange,
  createSupabaseScheduleGateway,
  listTeamSchedule,
  scheduleMessages,
} from "@stable/schedule";

import { ClubAdminShell } from "../../../../components/club-admin-shell";
import { SchedulePanel } from "../../../../components/schedule-panel";
import { fixtureAccessFrom } from "../../../../lib/fixture-access";
import { loadLiveClubContext } from "../../../../lib/load-live-club-context";
import { principalFromSupabase } from "../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type SchedulePageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamSchedulePage({ params }: SchedulePageProps) {
  const { teamId } = await params;
  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return <ClubAdminShell presentation={presentation} />;
  }

  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  const reader = await createRuntimeClubContextReader(supabase);
  const context = await getCurrentClubContext({ principal, reader });
  const club = context.club;
  if (club === null || principal === null) {
    return <ClubAdminShell presentation={presentation} />;
  }

  const team =
    await createSupabaseFixtureGateway(supabase).readVisibleTeam(teamId);
  if (team === null || team.clubId !== club.id) {
    return (
      <ClubAdminShell presentation={presentation}>
        <p role="alert">{scheduleMessages.notFound}</p>
      </ClubAdminShell>
    );
  }

  const facts = await reader.read(principal.userId);
  const range = agendaRange(new Date());
  let entries: Awaited<ReturnType<typeof listTeamSchedule>> = [];
  let error: string | undefined;
  try {
    entries = await listTeamSchedule({
      ...fixtureAccessFrom(principal, facts, team.active),
      clubId: club.id,
      teamId: team.id,
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
      eventType: null,
      reader: createSupabaseScheduleGateway(supabase),
    });
  } catch (caught: unknown) {
    error =
      caught instanceof ApplicationError
        ? caught.message
        : scheduleMessages.readFailed;
  }

  return (
    <ClubAdminShell presentation={presentation}>
      <SchedulePanel teamName={team.name} entries={entries} error={error} />
    </ClubAdminShell>
  );
}
