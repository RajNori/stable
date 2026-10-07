import { ApplicationError } from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";
import { createSupabaseFixtureGateway } from "@stable/fixtures";
import { evaluateCapability } from "@stable/permissions";
import {
  createSupabasePracticePlannerGateway,
  readPracticePlanner,
} from "@stable/practice-planner";
import {
  agendaRange,
  createSupabaseScheduleGateway,
  listTeamSchedule,
  scheduleMessages,
} from "@stable/schedule";
import { trainingMessages } from "@stable/training";

import { ClubAdminShell } from "../../../../components/club-admin-shell";
import { TrainingPanel } from "../../../../components/training-panel";
import { PracticePlannerPanel } from "../../../../components/practice-planner-panel";
import { fixtureAccessFrom } from "../../../../lib/fixture-access";
import { loadLiveClubContext } from "../../../../lib/load-live-club-context";
import { principalFromSupabase } from "../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  checkInTrainingAction,
  createTrainingSeriesAction,
  createTrainingSessionAction,
  savePracticePlanAction,
  copyPracticePlanAction,
  savePracticeDrillAction,
} from "./actions";

export const dynamic = "force-dynamic";

type TrainingPageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const visibleErrors = new Set<string>(Object.values(trainingMessages));

export default async function TrainingPage({
  params,
  searchParams,
}: TrainingPageProps) {
  const { teamId } = await params;
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
        <p role="alert">{trainingMessages.notFound}</p>
      </ClubAdminShell>
    );
  }

  const facts = await reader.read(principal.userId);
  const access = fixtureAccessFrom(principal, facts, team.active);
  const resource = {
    clubId: club.id,
    teamId: team.id,
    teamActive: team.active,
  };
  const canManage =
    evaluateCapability({
      ...access,
      resource,
      capability: "training.manage",
    }) === "allow";
  const canCheckIn =
    evaluateCapability({
      ...access,
      resource,
      capability: "coach_checkin",
    }) === "allow";
  const canManagePracticePlan =
    evaluateCapability({
      ...access,
      resource,
      capability: "practice_plan.manage",
    }) === "allow";
  const range = agendaRange(new Date());
  let sessions: { eventId: string; startsAt: string }[] = [];
  let error =
    requestedError !== undefined && visibleErrors.has(requestedError)
      ? requestedError
      : undefined;
  let plannerData: Awaited<ReturnType<typeof readPracticePlanner>> = {
    trainings: [],
    templates: [],
    focusOptions: [],
    drills: [],
  };
  if (canManagePracticePlan) {
    try {
      plannerData = await readPracticePlanner({
        ...access,
        clubId: club.id,
        teamId: team.id,
        writer: createSupabasePracticePlannerGateway(supabase, team.id),
      });
    } catch {
      error = trainingMessages.readFailed;
    }
  }
  try {
    const agenda = await listTeamSchedule({
      ...access,
      clubId: club.id,
      teamId: team.id,
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
      eventType: "TRAINING",
      reader: createSupabaseScheduleGateway(supabase),
    });
    sessions = agenda.map((entry) => ({
      eventId: entry.eventId,
      startsAt: entry.startsAt,
    }));
  } catch (caught: unknown) {
    error =
      caught instanceof ApplicationError
        ? caught.message
        : scheduleMessages.readFailed;
  }

  return (
    <ClubAdminShell presentation={presentation}>
      <TrainingPanel
        clubId={club.id}
        teamId={team.id}
        timezone={club.timezone}
        sessions={sessions}
        canManage={canManage}
        canCheckIn={canCheckIn}
        error={error}
        createSession={createTrainingSessionAction}
        createSeries={createTrainingSeriesAction}
        checkIn={checkInTrainingAction}
      />
      <PracticePlannerPanel
        clubId={club.id}
        teamId={team.id}
        trainings={plannerData.trainings}
        templates={plannerData.templates}
        focusOptions={plannerData.focusOptions}
        drills={plannerData.drills}
        canManage={canManagePracticePlan}
        error={error}
        save={savePracticePlanAction}
        copy={copyPracticePlanAction}
        createDrill={savePracticeDrillAction}
      />
    </ClubAdminShell>
  );
}
