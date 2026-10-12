import type { CurrentClubContext } from "@stable/contracts";
import type { GameDayProjection } from "@stable/game-day";
import type { ScheduleEntry } from "@stable/schedule";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { GuardianHomeScreen } from "./guardian-home-screen";

const teamId = "99999999-9999-4999-8999-999999999999";
const clubId = "11111111-1111-4111-8111-111111111111";
const eventId = "55555555-5555-4555-8555-555555555555";
const context: CurrentClubContext = {
  userId: "19191919-1919-4919-8919-191919191919",
  displayName: "Alex",
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
  managedPlayerIds: ["88888888-8888-4888-8888-888888888888"],
};
const upcoming: ScheduleEntry = {
  eventId,
  clubId,
  teamId,
  eventType: "GAME",
  startsAt: "2026-10-11T04:30:00.000Z",
  endsAt: null,
  courtLabel: "Court 2",
  eventStatus: "SCHEDULED",
  opponentName: "Southside",
  roundLabel: "Round 2",
};
const day: GameDayProjection = {
  eventId,
  clubId,
  teamId,
  opponentName: "Southside",
  roundLabel: "Round 2",
  officialStartAt: upcoming.startsAt,
  arrivalAt: null,
  venueText: null,
  courtLabel: "Court 2",
  uniformNote: null,
  coachFocus: null,
  ownRsvp: "UNANSWERED",
  ownDutyLabel: "Scorebook",
  ownDutyStatus: "ASSIGNED",
  fillInLabel: null,
  attendingCount: null,
  unavailableCount: null,
  unsureCount: null,
  unansweredCount: null,
};

async function renderHome(input?: {
  entries?: ScheduleEntry[];
  gameDay?: GameDayProjection | null;
  onOpenSchedule?: () => void;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return await render(
    <QueryClientProvider client={client}>
      <GuardianHomeScreen
        loadContext={() => Promise.resolve(context)}
        loadSchedule={() => Promise.resolve(input?.entries ?? [upcoming])}
        loadGameDay={() => Promise.resolve(input?.gameDay ?? day)}
        onOpenSchedule={input?.onOpenSchedule ?? (() => undefined)}
        now={Date.parse("2026-10-10T00:00:00.000Z")}
      />
    </QueryClientProvider>,
  );
}

describe("Guardian home", () => {
  it("shows the next event and current RSVP/duty, with a Schedule action", async () => {
    let openedSchedule = false;
    await renderHome({ onOpenSchedule: openSchedule });

    expect(await screen.findByRole("header", { name: "Hi Alex" })).toBeTruthy();
    expect(screen.getByText("Round 2: Southside")).toBeTruthy();
    expect(screen.getByText("Court 2")).toBeTruthy();
    expect(await screen.findByText("Your RSVP: UNANSWERED")).toBeTruthy();
    expect(await screen.findByText("Your duty: Scorebook")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Open schedule" }));
    expect(openedSchedule).toBe(true);

    function openSchedule() {
      openedSchedule = true;
    }
  });

  it("shows a helpful empty state when no upcoming events exist", async () => {
    await renderHome({ entries: [] });
    expect(await screen.findByText("Nothing scheduled yet.")).toBeTruthy();
  });

  it("does not show game actions for a different game projection", async () => {
    await renderHome({
      gameDay: { ...day, eventId: "77777777-7777-4777-8777-777777777777" },
    });
    expect(await screen.findByText("Round 2: Southside")).toBeTruthy();
    expect(screen.queryByText(/Your RSVP/)).toBeNull();
  });
});
