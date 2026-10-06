import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import type { CurrentClubContext } from "@stable/contracts";
import type { ScheduleEntry } from "@stable/schedule";

import { TeamScheduleScreen } from "./team-schedule-screen";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";

const context: CurrentClubContext = {
  userId: "19191919-1919-4919-8919-191919191919",
  displayName: "Local Guardian",
  club: {
    id: clubId,
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

function entry(
  eventType: ScheduleEntry["eventType"],
  startsAt: string,
): ScheduleEntry {
  return {
    eventId:
      eventType === "GAME"
        ? "55555555-5555-4555-8555-555555555555"
        : "66666666-6666-4666-8666-666666666666",
    clubId,
    teamId,
    eventType,
    startsAt,
    endsAt: null,
    courtLabel: null,
    eventStatus: "SCHEDULED",
    opponentName: eventType === "GAME" ? "Visitors" : null,
    roundLabel: eventType === "GAME" ? "Round 1" : null,
  };
}

describe("team schedule screen", () => {
  it("shows the active team agenda, including training", async () => {
    const calls: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamScheduleScreen
          loadContext={() => Promise.resolve(context)}
          loadSchedule={(requested) => {
            calls.push(requested);
            return Promise.resolve([
              entry("GAME", "2026-10-10T07:30:00.000Z"),
              entry("TRAINING", "2026-10-12T07:00:00.000Z"),
            ]);
          }}
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Round 1: Visitors at 2026-10-10T07:30:00.000Z"),
    ).toBeTruthy();
    expect(
      screen.getByText("Training at 2026-10-12T07:00:00.000Z"),
    ).toBeTruthy();
    expect(calls).toEqual([teamId]);
  });

  it("shows an empty range", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamScheduleScreen
          loadContext={() => Promise.resolve(context)}
          loadSchedule={() => Promise.resolve([])}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No events in this range.")).toBeTruthy();
  });
});
