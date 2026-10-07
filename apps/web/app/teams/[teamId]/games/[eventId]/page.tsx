import { ApplicationError } from "@stable/contracts";
import { attendanceMessages } from "@stable/attendance";
import { getCurrentClubContext } from "@stable/current-club-context";
import { createSupabaseFixtureGateway } from "@stable/fixtures";
import {
  createSupabaseGameDayGateway,
  gameDayMessages,
  previewDutyAllocation,
  readGameDay,
} from "@stable/game-day";
import { evaluateCapability } from "@stable/permissions";
import { createSupabaseRosterGateway, listTeamRoster } from "@stable/roster";

import { ClubAdminShell } from "../../../../../components/club-admin-shell";
import { GameDayPanel } from "../../../../../components/game-day-panel";
import { fixtureAccessFrom } from "../../../../../lib/fixture-access";
import { loadLiveClubContext } from "../../../../../lib/load-live-club-context";
import { principalFromSupabase } from "../../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import {
  acceptDutySwapAction,
  acknowledgeDutyAction,
  commitDutyAllocationAction,
  createOpenDutyAction,
  recordAttendanceAction,
  requestDutySwapAction,
} from "./actions";

export const dynamic = "force-dynamic";

type GameDayPageProps = {
  params: Promise<{ teamId: string; eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const visibleErrors = new Set<string>([
  attendanceMessages.unauthenticated,
  attendanceMessages.forbidden,
  attendanceMessages.notFound,
  attendanceMessages.validationFailed,
  attendanceMessages.saveFailed,
  attendanceMessages.readFailed,
  gameDayMessages.unauthenticated,
  gameDayMessages.forbidden,
  gameDayMessages.notFound,
  gameDayMessages.validationFailed,
  gameDayMessages.saveFailed,
  gameDayMessages.readFailed,
]);

export default async function GameDayPage({
  params,
  searchParams,
}: GameDayPageProps) {
  const { teamId, eventId } = await params;
  const query = await searchParams;
  const queryError = query["error"];
  const requestedError = Array.isArray(queryError) ? queryError[0] : queryError;
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
  const access = fixtureAccessFrom(principal, facts, team.active);
  let projection = null;
  let error =
    requestedError !== undefined && visibleErrors.has(requestedError)
      ? requestedError
      : undefined;
  try {
    projection = await readGameDay({
      ...access,
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

  const managed = new Set(
    facts.registrations
      .filter(
        (registration) =>
          registration.teamId === team.id &&
          registration.clubId === club.id &&
          registration.active,
      )
      .map((registration) => registration.playerId)
      .filter((playerId) =>
        facts.guardianLinks.some(
          (link) =>
            link.playerId === playerId &&
            link.clubId === club.id &&
            link.active &&
            link.playerActive,
        ),
      ),
  );
  let players: { playerId: string; label: string }[] = [];
  if (managed.size > 0) {
    try {
      const roster = await listTeamRoster({
        ...access,
        clubId: club.id,
        teamId: team.id,
        reader: createSupabaseRosterGateway(supabase),
      });
      players = roster.entries
        .filter((entry) => managed.has(entry.playerId))
        .map((entry) => ({ playerId: entry.playerId, label: entry.name }));
    } catch {
      players = [];
    }
  }

  const canRespond =
    evaluateCapability({
      ...access,
      resource: { clubId: club.id, teamId: team.id, teamActive: team.active },
      capability: "duty.respond",
    }) === "allow";
  let swaps: { id: string; label: string }[] = [];
  if (canRespond && projection !== null) {
    try {
      swaps = await createSupabaseGameDayGateway(supabase).listOpenDutySwaps(
        projection.eventId,
      );
    } catch (caught: unknown) {
      error =
        caught instanceof ApplicationError
          ? caught.message
          : gameDayMessages.readFailed;
    }
  }
  const canManageDuties =
    evaluateCapability({
      ...access,
      resource: { clubId: club.id, teamId: team.id, teamActive: team.active },
      capability: "duty.manage",
    }) === "allow";
  let dutyProposal: { fingerprint: string; lines: string[] } | undefined;
  if (canManageDuties && projection !== null) {
    try {
      const preview = await previewDutyAllocation({
        ...access,
        clubId: club.id,
        teamId: team.id,
        eventId: projection.eventId,
        writer: createSupabaseGameDayGateway(supabase),
      });
      dutyProposal = {
        fingerprint: preview.fingerprint,
        lines: preview.proposals.map(
          (proposal) =>
            `${proposal.dutyId} count ${String(proposal.priorCount)}`,
        ),
      };
    } catch (caught: unknown) {
      error =
        caught instanceof ApplicationError
          ? caught.message
          : gameDayMessages.readFailed;
    }
  }

  return (
    <ClubAdminShell presentation={presentation}>
      <GameDayPanel
        projection={projection}
        error={error}
        players={players}
        recordAction={recordAttendanceAction}
        {...(dutyProposal === undefined ? {} : { dutyProposal })}
        {...(canManageDuties
          ? {
              createDuty: createOpenDutyAction,
              commitDuty: commitDutyAllocationAction,
            }
          : {})}
        {...(projection?.ownDutyLabel !== null && projection !== null
          ? {
              acknowledgeDuty: acknowledgeDutyAction,
              requestSwap: requestDutySwapAction,
            }
          : {})}
        {...(canRespond ? { swaps, acceptSwap: acceptDutySwapAction } : {})}
      />
    </ClubAdminShell>
  );
}
