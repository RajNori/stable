import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import type { CurrentClubContext } from "@stable/contracts";
import type { GameDayProjection } from "@stable/game-day";

import { TeamGameDayScreen } from "./team-game-day-screen";

const teamId = "99999999-9999-4999-8999-999999999999";

const context: CurrentClubContext = {
  userId: "19191919-1919-4919-8919-191919191919",
  displayName: "Local Guardian",
  club: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Mentone Mustangs",
    slug: "mentone-mustangs",
    timezone: "Australia/Melbourne",
    themeKey: "mustangs",
  },
  activeTeam: { id: teamId, name: "U14 Boys" },
  availableTeams: [{ id: teamId, name: "U14 Boys" }],
  capabilities: ["club.read"],
  managedPlayerIds: [],
};

const projection: GameDayProjection = {
  eventId: "55555555-5555-4555-8555-555555555555",
  clubId: "11111111-1111-4111-8111-111111111111",
  teamId,
  opponentName: "Visitors",
  roundLabel: "Round 1",
  officialStartAt: "2026-10-10T07:30:00.000Z",
  arrivalAt: null,
  venueText: null,
  courtLabel: null,
  uniformNote: null,
  coachFocus: null,
  ownRsvp: "UNANSWERED",
  ownDutyLabel: "Scorebook",
  ownDutyStatus: "ASSIGNED",
  attendingCount: null,
  unavailableCount: null,
  unsureCount: null,
  unansweredCount: null,
};

describe("team game day screen", () => {
  it("shows the caller's RSVP and duty without staff counts", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamGameDayScreen
          loadContext={() => Promise.resolve(context)}
          loadGameDay={() => Promise.resolve(projection)}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Round 1: Visitors")).toBeTruthy();
    expect(screen.getByText("RSVP UNANSWERED")).toBeTruthy();
    expect(screen.getByText("Duty Scorebook")).toBeTruthy();
    expect(screen.queryByText(/Attending/)).toBeNull();
  });
});
