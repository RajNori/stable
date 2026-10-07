import type { AnnouncementRecord } from "@stable/announcements";
import type { CurrentClubContext } from "@stable/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, userEvent } from "@testing-library/react-native";
import React from "react";

import { TeamAnnouncementsScreen } from "./team-announcements-screen";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";

const announcement: AnnouncementRecord = {
  id: "55555555-5555-4555-8555-555555555555",
  clubId,
  teamId,
  authorUserId: "19191919-1919-4919-8919-191919191919",
  category: "GENERAL",
  importance: "NORMAL",
  title: "Bring water",
  body: "Saturday is hot.",
  acknowledgementRequired: true,
  publishedAt: "2026-10-07T00:00:00.000Z",
  archivedAt: null,
  readAt: null,
  acknowledgedAt: null,
};

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
  capabilities: ["club.read"] as CurrentClubContext["capabilities"],
  managedPlayerIds: [],
};

describe("team announcements", () => {
  it("lets a reader acknowledge an update", async () => {
    const acknowledged: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamAnnouncementsScreen
          loadContext={() => Promise.resolve(context)}
          loadAnnouncements={() => Promise.resolve([announcement])}
          acknowledge={(item) => {
            acknowledged.push(item.id);
            return Promise.resolve();
          }}
          markRead={() => Promise.resolve()}
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    expect(await screen.findByText("Bring water")).toBeTruthy();
    await user.press(
      screen.getByRole("button", { name: "Acknowledge Bring water" }),
    );
    expect(acknowledged).toEqual([announcement.id]);
  });
});
