import { ApplicationError } from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";
import { createSupabaseFixtureGateway } from "@stable/fixtures";
import {
  createSupabaseGameDayGateway,
  gameDayMessages,
  readGameDay,
} from "@stable/game-day";

import { ClubAdminShell } from "../../../../../components/club-admin-shell";
import { GameDayPanel } from "../../../../../components/game-day-panel";
import { fixtureAccessFrom } from "../../../../../lib/fixture-access";
import { loadLiveClubContext } from "../../../../../lib/load-live-club-context";
import { principalFromSupabase } from "../../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type GameDayPageProps = {
  params: Promise<{ teamId: string; eventId: string }>;
};

export default async function GameDayPage({ params }: GameDayPageProps) {
  const { teamId, eventId } = await params;
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
        <p role="alert">{gameDayMessages.notFound}</p>
      </ClubAdminShell>
    );
  }

  const facts = await reader.read(principal.userId);
  let projection = null;
  let error: string | undefined;
  try {
    projection = await readGameDay({
      ...fixtureAccessFrom(principal, facts, team.active),
      clubId: club.id,
      teamId: team.id,
      eventId,
      reader: createSupabaseGameDayGateway(supabase),
    });
  } catch (caught: unknown) {
    error =
      caught instanceof ApplicationError
        ? caught.message
        : gameDayMessages.readFailed;
  }

  return (
    <ClubAdminShell presentation={presentation}>
      <GameDayPanel projection={projection} error={error} />
    </ClubAdminShell>
  );
}
