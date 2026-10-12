import { restoreAuthSession } from "@stable/auth";
import {
  createSupabaseAnnouncementGateway,
  listTeamAnnouncements,
  type AnnouncementRecord,
} from "@stable/announcements";
import type { ClubContextReadResult } from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";
import { createSupabaseFixtureGateway } from "@stable/fixtures";
import {
  createSupabaseGameDayGateway,
  readGameDay,
  readTeamManagerGameDayOperations,
  type TeamManagerGameDayOperations,
} from "@stable/game-day";
import {
  createSupabaseClubStructureGateway,
  type ClubStructureGateway,
} from "@stable/club-structure";
import { createSupabaseMembershipGateway } from "@stable/membership";
import type { ScheduleEntry } from "@stable/schedule";
import {
  createSupabaseScheduleGateway,
  listTeamSchedule,
} from "@stable/schedule";

import { ClubAdminShell } from "../components/club-admin-shell";
import {
  ClubAdminHomePanel,
  type ClubAdminHomeSummary,
} from "../components/club-admin-home-panel";
import { ClubSignInLive } from "../components/club-sign-in-live";
import {
  RoleHomePanel,
  type RoleHomeRole,
} from "../components/role-home-panel";
import { SignOutButton } from "../components/sign-out-button";
import { loadWebBootEnv } from "../lib/boot-env.server";
import {
  contextFixtureFromQuery,
  fixtureClubContextInput,
} from "../lib/fixtures";
import { callbackNotice, shouldLoadClubContext } from "../lib/home-auth";
import { loadClubContext } from "../lib/load-club-context";
import { loadLiveClubContext } from "../lib/load-live-club-context";
import { fixtureAccessFrom } from "../lib/fixture-access";
import { principalFromSupabase } from "../lib/principal";
import { createClubContextReader } from "../lib/reader";
import { webAuthSessionGatewayFromSupabase } from "../lib/auth-session";
import { createSupabaseServerClient } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const fixtureName = contextFixtureFromQuery(params["fixture"]);

  if (fixtureName === "loading") {
    return <ClubAdminShell presentation={{ status: "loading" }} />;
  }

  if (fixtureName === null) {
    const boot = loadWebBootEnv();
    const client = await createSupabaseServerClient();
    const decision = await restoreAuthSession(
      webAuthSessionGatewayFromSupabase(client),
    );
    if (!shouldLoadClubContext(decision.snapshot)) {
      return (
        <ClubSignInLive
          session={decision.snapshot}
          supabaseUrl={boot.supabaseUrl}
          publishableKey={boot.supabasePublishableKey}
          webOrigin={boot.webOrigin ?? "http://127.0.0.1:3000"}
          notice={callbackNotice(params)}
        />
      );
    }

    const presentation = await loadLiveClubContext();
    if (presentation.status !== "member") {
      return <ClubAdminShell presentation={presentation} />;
    }

    const principal = await principalFromSupabase(client);
    const reader = await createClubContextReader(client);
    if (principal === null) {
      return <ClubAdminShell presentation={presentation} />;
    }
    const context = await getCurrentClubContext({ principal, reader });
    const teamChoices = context.availableTeams;
    if (context.club === null) {
      return (
        <ClubAdminShell
          presentation={presentation}
          accessory={
            <SignOutButton
              supabaseUrl={boot.supabaseUrl}
              publishableKey={boot.supabasePublishableKey}
            />
          }
        />
      );
    }

    let adminHomeSummary: ClubAdminHomeSummary | null = null;
    let adminHomeError: string | undefined;
    if (presentation.capabilities.includes("club.manage")) {
      try {
        adminHomeSummary = await readClubAdminHome(client, context.club.id);
      } catch {
        adminHomeError = "Club setup status could not be loaded.";
      }
    }

    if (teamChoices.length === 0) {
      return (
        <ClubAdminShell
          presentation={presentation}
          accessory={
            <SignOutButton
              supabaseUrl={boot.supabaseUrl}
              publishableKey={boot.supabasePublishableKey}
            />
          }
        >
          {presentation.capabilities.includes("club.manage") ? (
            <ClubAdminHomePanel
              summary={adminHomeSummary}
              themeKey={context.club.themeKey}
              {...(adminHomeError === undefined
                ? {}
                : { error: adminHomeError })}
            />
          ) : null}
        </ClubAdminShell>
      );
    }

    const requestedTeam = firstString(params["team"]);
    const selectedTeam =
      requestedTeam === undefined
        ? (context.activeTeam ??
          (teamChoices.length === 1 ? (teamChoices[0] ?? null) : null))
        : (teamChoices.find((team) => team.id === requestedTeam) ?? null);
    const facts = await reader.read(principal.userId);
    const availableRoles = rolesForTeam(selectedTeam?.id ?? null, facts);
    const requestedView = firstString(params["view"]);
    const requestedRole = roleForView(requestedView);
    const role =
      requestedRole !== null && availableRoles.includes(requestedRole)
        ? requestedRole
        : (availableRoles.find((candidate) => candidate !== "Guardian") ??
          availableRoles[0] ??
          null);
    let nextGame: ScheduleEntry | null = null;
    let nextTraining: ScheduleEntry | null = null;
    let gameDay: Awaited<ReturnType<typeof readGameDay>> | null = null;
    let managerOperations: TeamManagerGameDayOperations | null = null;
    let managerOperationsError: string | undefined;
    let latestAnnouncement: AnnouncementRecord | null = null;
    let homeError: string | undefined;

    if (selectedTeam !== null) {
      try {
        const team = await createSupabaseFixtureGateway(client).readVisibleTeam(
          selectedTeam.id,
        );
        if (team === null || team.clubId !== context.club.id || !team.active) {
          homeError = "This team context is not available.";
        } else {
          const access = fixtureAccessFrom(principal, facts, team.active);
          try {
            const announcements = await listTeamAnnouncements({
              ...access,
              clubId: context.club.id,
              teamId: team.id,
              includeArchived: false,
              writer: createSupabaseAnnouncementGateway(client),
            });
            latestAnnouncement =
              announcements.reduce<AnnouncementRecord | null>(
                (latest, announcement) =>
                  latest === null ||
                  Date.parse(announcement.publishedAt) >
                    Date.parse(latest.publishedAt)
                    ? announcement
                    : latest,
                null,
              );
          } catch {
            // Keep the schedule useful if the separate announcement projection is unavailable.
          }
          const rangeStart = new Date();
          const rangeEnd = new Date(rangeStart);
          rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 90);
          const entries = await listTeamSchedule({
            ...access,
            clubId: context.club.id,
            teamId: team.id,
            rangeStart: rangeStart.toISOString(),
            rangeEnd: rangeEnd.toISOString(),
            eventType: null,
            reader: createSupabaseScheduleGateway(client),
          });
          nextGame =
            entries.find(
              (entry) =>
                entry.eventStatus === "SCHEDULED" && entry.eventType === "GAME",
            ) ?? null;
          nextTraining =
            entries.find(
              (entry) =>
                entry.eventStatus === "SCHEDULED" &&
                entry.eventType === "TRAINING",
            ) ?? null;
          if (nextGame !== null) {
            try {
              gameDay = await readGameDay({
                ...access,
                clubId: context.club.id,
                teamId: team.id,
                eventId: nextGame.eventId,
                reader: createSupabaseGameDayGateway(client),
              });
            } catch {
              // A schedule remains useful if a separate Game Day projection is unavailable.
            }
            if (role === "Team Manager") {
              try {
                managerOperations = await readTeamManagerGameDayOperations({
                  ...access,
                  clubId: context.club.id,
                  teamId: team.id,
                  eventId: nextGame.eventId,
                  reader: createSupabaseGameDayGateway(client),
                });
              } catch {
                managerOperationsError =
                  "Game Day operations status could not be loaded.";
              }
            }
          }
        }
      } catch {
        homeError = "Your team schedule could not be loaded. Try again.";
      }
    }

    return (
      <ClubAdminShell
        presentation={presentation}
        accessory={
          <SignOutButton
            supabaseUrl={boot.supabaseUrl}
            publishableKey={boot.supabasePublishableKey}
          />
        }
      >
        {presentation.capabilities.includes("club.manage") ? (
          <ClubAdminHomePanel
            summary={adminHomeSummary}
            themeKey={context.club.themeKey}
            {...(adminHomeError === undefined ? {} : { error: adminHomeError })}
          />
        ) : null}
        <RoleHomePanel
          role={role}
          availableRoles={availableRoles}
          teams={teamChoices}
          selectedTeam={selectedTeam}
          nextGame={nextGame}
          nextTraining={nextTraining}
          gameDay={gameDay}
          managerOperations={managerOperations}
          {...(managerOperationsError === undefined
            ? {}
            : { managerOperationsError })}
          latestAnnouncement={latestAnnouncement}
          timezone={context.club.timezone}
          themeKey={context.club.themeKey}
          {...(homeError === undefined ? {} : { error: homeError })}
        />
      </ClubAdminShell>
    );
  }

  const presentation = await loadClubContext(
    fixtureClubContextInput(fixtureName),
  );
  return <ClubAdminShell presentation={presentation} />;
}

async function readClubAdminHome(
  client: unknown,
  clubId: string,
): Promise<ClubAdminHomeSummary> {
  const structure: ClubStructureGateway =
    createSupabaseClubStructureGateway(client);
  const membership = createSupabaseMembershipGateway(client);
  const snapshot = await structure.list(clubId);
  const activeTeams = snapshot.teams.filter((team) => team.active);
  const teamStaff = await Promise.all(
    activeTeams.map(async (team) => ({
      team,
      assignments: await membership.listTeamStaff(team.id),
    })),
  );
  const teamsNeedingLeadership = teamStaff.flatMap(({ team, assignments }) => {
    const activeRoles = new Set(
      assignments
        .filter((assignment) => assignment.active)
        .map((assignment) => assignment.role),
    );
    const missingRoles = [
      ...(!activeRoles.has("HEAD_COACH") ? (["Head Coach"] as const) : []),
      ...(!activeRoles.has("TEAM_MANAGER") ? (["Team Manager"] as const) : []),
    ];
    return missingRoles.length === 0
      ? []
      : [{ id: team.id, name: team.name, missingRoles }];
  });
  return {
    activeTeamCount: activeTeams.length,
    activeSeasonCount: snapshot.seasons.filter((season) => season.active)
      .length,
    teamsNeedingLeadership,
  };
}

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function roleForView(view: string | undefined): RoleHomeRole | null {
  switch (view) {
    case "head-coach":
      return "Head Coach";
    case "assistant-coach":
      return "Assistant Coach";
    case "team-manager":
      return "Team Manager";
    case "guardian":
      return "Guardian";
    default:
      return null;
  }
}

function rolesForTeam(
  teamId: string | null,
  facts: ClubContextReadResult,
): RoleHomeRole[] {
  if (teamId === null) return [];
  const staffRoles = new Set(
    facts.teamMemberships
      .filter(
        (membership) =>
          membership.teamId === teamId &&
          membership.active &&
          membership.teamActive,
      )
      .map((membership) => membership.role),
  );
  const roles: RoleHomeRole[] = [];
  if (staffRoles.has("HEAD_COACH")) roles.push("Head Coach");
  if (staffRoles.has("ASSISTANT_COACH")) roles.push("Assistant Coach");
  if (staffRoles.has("TEAM_MANAGER")) roles.push("Team Manager");

  const managedPlayerIds = new Set(
    facts.guardianLinks
      .filter(
        (link) =>
          link.active &&
          link.playerActive &&
          facts.registrations.some(
            (registration) =>
              registration.active &&
              registration.teamActive &&
              registration.playerId === link.playerId &&
              registration.teamId === teamId &&
              registration.clubId === link.clubId,
          ),
      )
      .map((link) => link.playerId),
  );
  const managesSelectedTeam = facts.registrations.some(
    (registration) =>
      registration.active &&
      registration.teamActive &&
      registration.teamId === teamId &&
      managedPlayerIds.has(registration.playerId),
  );
  if (managesSelectedTeam) roles.push("Guardian");
  return roles;
}
