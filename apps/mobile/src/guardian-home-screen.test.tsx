import type { CurrentClubContext } from "@stable/contracts";
import type { AnnouncementRecord } from "@stable/announcements";
import type { GameDayProjection } from "@stable/game-day";
import type { ScheduleEntry } from "@stable/schedule";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react-native";
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
  arrivalAt: "2026-10-11T04:00:00.000Z",
  venueText: "Mentone Stadium",
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
const announcement: AnnouncementRecord = {
  id: "77777777-7777-4777-8777-777777777777",
  clubId,
  teamId,
  authorUserId: "19191919-1919-4919-8919-191919191919",
  category: "GENERAL",
  importance: "NORMAL",
  title: "Bring the blue singlet",
  body: "Use the away uniform this weekend.",
  acknowledgementRequired: true,
  publishedAt: "2026-10-09T01:00:00.000Z",
  archivedAt: null,
  acknowledgedAt: null,
  readAt: null,
};

async function renderHome(input?: {
  entries?: ScheduleEntry[];
  gameDay?: GameDayProjection | null;
  onOpenSchedule?: () => void;
  onOpenGameDay?: () => void;
  onOpenUpdates?: () => void;
  announcements?: AnnouncementRecord[];
}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <GuardianHomeScreen
        loadContext={() => Promise.resolve(context)}
        loadSchedule={() => Promise.resolve(input?.entries ?? [upcoming])}
        loadGameDay={() => Promise.resolve(input?.gameDay ?? day)}
        loadAnnouncements={() => Promise.resolve(input?.announcements ?? [])}
        onOpenSchedule={input?.onOpenSchedule ?? (() => undefined)}
        onOpenGameDay={input?.onOpenGameDay ?? (() => undefined)}
        onOpenUpdates={input?.onOpenUpdates ?? (() => undefined)}
        now={Date.parse("2026-10-10T00:00:00.000Z")}
      />
    </QueryClientProvider>,
  );
}

describe("Guardian home", () => {
  it("shows the next event and duty without attributing a sibling RSVP", async () => {
    let openedSchedule = false;
    let openedGameDay = false;
    const view = await renderHome({
      onOpenSchedule: () => {
        openedSchedule = true;
      },
      onOpenGameDay: () => {
        openedGameDay = true;
      },
    });

    expect(await view.findByRole("header", { name: "Hi Alex" })).toBeTruthy();
    expect(view.getByText("Round 2: Southside")).toBeTruthy();
    expect(view.getByText("Court 2")).toBeTruthy();
    expect(view.queryByText(/Your RSVP/)).toBeNull();
    expect(await view.findByText("Your duty: Scorebook")).toBeTruthy();
    expect(view.getByText(/Arrive/)).toBeTruthy();
    expect(view.getByText("Mentone Stadium")).toBeTruthy();
    expect(await view.findByText("No recent team updates.")).toBeTruthy();
    await fireEvent.press(
      view.getByRole("button", { name: "Respond to game" }),
    );
    expect(openedGameDay).toBe(true);
    await fireEvent.press(view.getByRole("button", { name: "Open schedule" }));
    expect(openedSchedule).toBe(true);
  });

  it("shows the latest team update and links to acknowledgements", async () => {
    let openedUpdates = false;
    const view = await renderHome({
      announcements: [announcement],
      onOpenUpdates: () => {
        openedUpdates = true;
      },
    });
    expect(await view.findByText(announcement.title)).toBeTruthy();
    expect(view.queryByText(/Your RSVP/)).toBeNull();
    expect(view.getByText(announcement.body)).toBeTruthy();
    expect(view.getByText("Response requested")).toBeTruthy();
    await fireEvent.press(
      view.getByRole("button", { name: "Open team updates" }),
    );
    expect(openedUpdates).toBe(true);
  });

  it("shows a helpful empty state when no upcoming events exist", async () => {
    const view = await renderHome({ entries: [] });
    expect(await view.findByText("Nothing scheduled yet.")).toBeTruthy();
    expect(await view.findByText("No recent team updates.")).toBeTruthy();
  });

  it("does not show game actions for a different game projection", async () => {
    const view = await renderHome({
      gameDay: { ...day, eventId: "77777777-7777-4777-8777-777777777777" },
    });
    expect(await view.findByText("Round 2: Southside")).toBeTruthy();
    expect(await view.findByText("No recent team updates.")).toBeTruthy();
    expect(view.queryByText(/Your RSVP/)).toBeNull();
  });
});
