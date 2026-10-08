import {
  announcementMessages,
  type AnnouncementRecord,
} from "@stable/announcements";
import { ApplicationError, type CurrentClubContext } from "@stable/contracts";
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
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
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

  it("registers and removes the token in the device field", async () => {
    const registered: string[] = [];
    const removed: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamAnnouncementsScreen
          loadContext={() => Promise.resolve(context)}
          loadAnnouncements={() => Promise.resolve([])}
          acknowledge={() => Promise.resolve()}
          markRead={() => Promise.resolve()}
          registerDevice={(token) => {
            registered.push(token);
            return Promise.resolve();
          }}
          removeDevice={(token) => {
            removed.push(token);
            return Promise.resolve();
          }}
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    expect(await screen.findByText("No announcements.")).toBeTruthy();
    await user.type(
      screen.getByLabelText("Device token"),
      "ExponentPushToken[phone]",
    );
    await user.press(screen.getByRole("button", { name: "Register device" }));
    await user.press(screen.getByRole("button", { name: "Remove device" }));
    expect(registered).toEqual(["ExponentPushToken[phone]"]);
    expect(removed).toEqual(["ExponentPushToken[phone]"]);
  });

  it("fails closed when team context cannot be loaded", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamAnnouncementsScreen
          loadContext={() => Promise.reject(new Error("provider response"))}
          loadAnnouncements={() => Promise.reject(new Error("must not load"))}
          acknowledge={() => Promise.resolve()}
          markRead={() => Promise.resolve()}
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText(announcementMessages.readFailed),
    ).toBeTruthy();
    expect(screen.queryByText("provider response")).toBeNull();
  });

  it("shows a safe forbidden state when there is no active club team", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamAnnouncementsScreen
          loadContext={() =>
            Promise.resolve({
              ...context,
              club: null,
              activeTeam: null,
              availableTeams: [],
            })
          }
          loadAnnouncements={() => Promise.reject(new Error("must not load"))}
          acknowledge={() => Promise.resolve()}
          markRead={() => Promise.resolve()}
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText(announcementMessages.forbidden),
    ).toBeTruthy();
  });

  it("shows a safe read error when team announcements are unavailable", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamAnnouncementsScreen
          loadContext={() => Promise.resolve(context)}
          loadAnnouncements={() =>
            Promise.reject(
              new ApplicationError(
                "UPSTREAM_UNAVAILABLE",
                announcementMessages.readFailed,
              ),
            )
          }
          acknowledge={() => Promise.resolve()}
          markRead={() => Promise.resolve()}
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText(announcementMessages.readFailed),
    ).toBeTruthy();
  });

  it("surfaces safe mark-read and acknowledgement failures", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamAnnouncementsScreen
          loadContext={() => Promise.resolve(context)}
          loadAnnouncements={() => Promise.resolve([announcement])}
          acknowledge={() =>
            Promise.reject(new Error("secret guardian contact detail"))
          }
          markRead={() =>
            Promise.reject(
              new ApplicationError("FORBIDDEN", "Cannot mark read"),
            )
          }
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole("button", { name: "Mark read Bring water" }),
    );
    expect(await screen.findByText("Cannot mark read")).toBeTruthy();

    await user.press(
      await screen.findByRole("button", { name: "Acknowledge Bring water" }),
    );
    expect(
      await screen.findByText(announcementMessages.readFailed),
    ).toBeTruthy();
    expect(screen.queryByText("secret guardian contact detail")).toBeNull();
  });

  it("marks an announcement as read and refreshes the list", async () => {
    const markedRead: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamAnnouncementsScreen
          loadContext={() => Promise.resolve(context)}
          loadAnnouncements={() => Promise.resolve([announcement])}
          acknowledge={() => Promise.resolve()}
          markRead={(item) => {
            markedRead.push(item.id);
            return Promise.resolve();
          }}
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole("button", { name: "Mark read Bring water" }),
    );

    expect(markedRead).toEqual([announcement.id]);
    expect(await screen.findByText("Bring water")).toBeTruthy();
  });

  it("surfaces safe device-registration and removal failures", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamAnnouncementsScreen
          loadContext={() => Promise.resolve(context)}
          loadAnnouncements={() => Promise.resolve([])}
          acknowledge={() => Promise.resolve()}
          markRead={() => Promise.resolve()}
          registerDevice={() =>
            Promise.reject(new Error("raw device provider response"))
          }
          removeDevice={() =>
            Promise.reject(
              new ApplicationError("FORBIDDEN", "Device removal denied"),
            )
          }
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    const token = await screen.findByLabelText("Device token");
    await user.type(token, "ExponentPushToken[synthetic]");
    await user.press(screen.getByRole("button", { name: "Register device" }));
    expect(
      await screen.findByText(announcementMessages.readFailed),
    ).toBeTruthy();

    await user.press(screen.getByRole("button", { name: "Remove device" }));
    expect(await screen.findByText("Device removal denied")).toBeTruthy();
    expect(screen.queryByText("raw device provider response")).toBeNull();
  });
});
