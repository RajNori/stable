import { createSupabaseClubStructureGateway } from "@stable/club-structure";
import { ApplicationError } from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";
import { createSupabaseMembershipGateway } from "@stable/membership";
import {
  childDisplayName,
  createSupabasePlayerGateway,
  playerMessages,
  registeredPlayerName,
} from "@stable/players";

import { ClubAdminShell } from "../../components/club-admin-shell";
import {
  PlayersPanel,
  type ClubAdultOption,
  type ManagedPlayer,
} from "../../components/players-panel";
import {
  contextFixtureFromQuery,
  fixtureClubContextInput,
} from "../../lib/fixtures";
import { loadClubContext } from "../../lib/load-club-context";
import { loadLiveClubContext } from "../../lib/load-live-club-context";
import { playerPageError } from "../../lib/player-page-error";
import { createRuntimeClubContextReader } from "../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { principalFromSupabase } from "../../lib/principal";
import {
  createPlayerAction,
  deactivatePlayerAction,
  importPlayersAction,
  linkGuardianAction,
  reactivatePlayerAction,
  unlinkGuardianAction,
  updatePlayerAction,
  registerPlayerAction,
  unregisterPlayerAction,
} from "./actions";

export const dynamic = "force-dynamic";

const FIXTURE_CLUB_ID = "11111111-1111-4111-8111-111111111111";
const FIXTURE_PLAYER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FIXTURE_ADULT_ID = "55555555-5555-4555-8555-555555555555";

type PlayersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const params = await searchParams;
  const error = playerPageError(params["error"], params["rows"]);
  const fixtureName = contextFixtureFromQuery(params["fixture"]);

  if (fixtureName === "loading") {
    return <ClubAdminShell presentation={{ status: "loading" }} />;
  }

  if (fixtureName !== null) {
    const presentation = await loadClubContext(
      fixtureClubContextInput(fixtureName),
    );
    if (fixtureName !== "member") {
      return <ClubAdminShell presentation={presentation} />;
    }
    return (
      <ClubAdminShell presentation={presentation}>
        <PlayersPanel
          clubId={FIXTURE_CLUB_ID}
          players={[fixturePlayer()]}
          adults={fixtureAdults()}
          error={error}
          teams={[
            { id: "17171717-1717-4717-8717-171717171717", name: "U14 Boys" },
          ]}
          {...panelActions()}
        />
      </ClubAdminShell>
    );
  }

  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return <ClubAdminShell presentation={presentation} />;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const principal = await principalFromSupabase(supabase);
    const reader = await createRuntimeClubContextReader(supabase);
    const context = await getCurrentClubContext({ principal, reader });
    if (context.club === null) {
      return <ClubAdminShell presentation={presentation} />;
    }

    const gateway = createSupabasePlayerGateway(supabase);
    const structure = createSupabaseClubStructureGateway(supabase);
    const membership = createSupabaseMembershipGateway(supabase);
    const [players, adults, registrations, snapshot] = await Promise.all([
      gateway.listPlayers(context.club.id),
      gateway.listClubAdults(context.club.id),
      membership.listRegistrations(context.club.id),
      structure.list(context.club.id),
    ]);
    const adultNames = new Map(
      adults.map((adult) => [adult.userId, adult.displayName]),
    );
    const teamNames = new Map(
      snapshot.teams.map((team) => [team.id, team.name]),
    );
    const managed = await Promise.all(
      players.map(async (player) => {
        const guardians = await gateway.listGuardians(player.id);
        const registration = registrations.find(
          (row) => row.playerId === player.id && row.active,
        );
        return {
          ...toManagedPlayer(player, guardians, adultNames),
          teamName:
            registration === undefined
              ? null
              : (teamNames.get(registration.teamId) ?? null),
        };
      }),
    );

    return (
      <ClubAdminShell presentation={presentation}>
        <PlayersPanel
          clubId={context.club.id}
          players={managed}
          adults={adults}
          error={error}
          teams={snapshot.teams.map((team) => ({
            id: team.id,
            name: team.name,
          }))}
          {...panelActions()}
        />
      </ClubAdminShell>
    );
  } catch (caught: unknown) {
    const message =
      caught instanceof ApplicationError
        ? caught.message
        : playerMessages.readFailed;
    return (
      <ClubAdminShell presentation={presentation}>
        <PlayersPanel
          clubId={null}
          players={[]}
          adults={[]}
          error={message}
          {...panelActions()}
        />
      </ClubAdminShell>
    );
  }
}

function panelActions() {
  return {
    createPlayer: createPlayerAction,
    importPlayers: importPlayersAction,
    updatePlayer: updatePlayerAction,
    deactivatePlayer: deactivatePlayerAction,
    reactivatePlayer: reactivatePlayerAction,
    linkGuardian: linkGuardianAction,
    unlinkGuardian: unlinkGuardianAction,
    registerPlayer: registerPlayerAction,
    unregisterPlayer: unregisterPlayerAction,
  };
}

function fixturePlayer(): ManagedPlayer {
  const firstName = "Alexander";
  const lastName = "Robertson";
  return {
    id: FIXTURE_PLAYER_ID,
    firstName,
    lastName,
    registeredName: registeredPlayerName(firstName, lastName),
    displayName: childDisplayName(firstName, lastName),
    active: true,
    guardians: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        guardianUserId: FIXTURE_ADULT_ID,
        active: true,
        label: "Local Member",
      },
    ],
  };
}

function fixtureAdults(): ClubAdultOption[] {
  return [{ userId: FIXTURE_ADULT_ID, displayName: "Local Member" }];
}

function toManagedPlayer(
  player: {
    id: string;
    firstName: string;
    lastName: string;
    active: boolean;
  },
  guardians: readonly {
    id: string;
    guardianUserId: string;
    active: boolean;
  }[],
  adultNames: ReadonlyMap<string, string>,
): ManagedPlayer {
  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    registeredName: registeredPlayerName(player.firstName, player.lastName),
    displayName: childDisplayName(player.firstName, player.lastName),
    active: player.active,
    guardians: guardians.map((guardian) => ({
      id: guardian.id,
      guardianUserId: guardian.guardianUserId,
      active: guardian.active,
      label: adultNames.get(guardian.guardianUserId) ?? "Linked adult",
    })),
  };
}
