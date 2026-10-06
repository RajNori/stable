import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import type { CurrentClubContext } from "@stable/contracts";
import type { TeamRoster } from "@stable/roster";

import { TeamRosterScreen } from "./team-roster-screen";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";
const otherTeamId = "88888888-8888-4888-8888-888888888888";
const playerId = "18181818-1818-4818-8818-181818181818";

const club = {
  id: clubId,
  name: "Mentone Mustangs",
  slug: "mentone-mustangs",
  timezone: "Australia/Melbourne",
  themeKey: "mustangs",
};

function context(
  teams: CurrentClubContext["availableTeams"],
): CurrentClubContext {
  return {
    userId: "19191919-1919-4919-8919-191919191919",
    displayName: "Local Guardian",
    club,
    activeTeam: teams.length === 1 ? (teams[0] ?? null) : null,
    availableTeams: teams,
    capabilities: ["club.read"] as CurrentClubContext["capabilities"],
    managedPlayerIds: [playerId],
  };
}

async function renderRoster(
  loadContext: () => Promise<CurrentClubContext>,
  loadRoster: (teamId: string) => Promise<TeamRoster>,
): Promise<void> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <TeamRosterScreen loadContext={loadContext} loadRoster={loadRoster} />
    </QueryClientProvider>,
  );
}

describe("team roster screen", () => {
  it("shows the masked name for the single active team", async () => {
    const calls: string[] = [];
    const loadRoster = (requested: string): Promise<TeamRoster> => {
      calls.push(requested);
      return Promise.resolve({
        teamId: requested,
        visibility: "masked",
        canManage: false,
        entries: [{ playerId, teamId: requested, name: "Alexander R." }],
      });
    };

    await renderRoster(
      () => Promise.resolve(context([{ id: teamId, name: "U14 Boys" }])),
      loadRoster,
    );

    expect(await screen.findByText("Alexander R.")).toBeTruthy();
    expect(screen.queryByText("Robertson")).toBeNull();
    expect(calls).toEqual([teamId]);
  });

  it("shows the registered name when the projection is full", async () => {
    await renderRoster(
      () => Promise.resolve(context([{ id: teamId, name: "U14 Boys" }])),
      () =>
        Promise.resolve({
          teamId,
          visibility: "full",
          canManage: false,
          entries: [{ playerId, teamId, name: "Alexander Robertson" }],
        }),
    );

    expect(await screen.findByText("Alexander Robertson")).toBeTruthy();
  });

  it("asks for one team and does not load another roster", async () => {
    let called = false;
    const loadRoster = (): Promise<TeamRoster> => {
      called = true;
      return Promise.reject(new Error("roster should not load"));
    };

    await renderRoster(
      () =>
        Promise.resolve(
          context([
            { id: teamId, name: "U14 Boys" },
            { id: otherTeamId, name: "U16 Boys" },
          ]),
        ),
      loadRoster,
    );

    expect(
      await screen.findByText("Use a context with one team."),
    ).toBeTruthy();
    expect(called).toBe(false);
    expect(screen.queryByText("U16 Boys")).toBeNull();
  });
});
