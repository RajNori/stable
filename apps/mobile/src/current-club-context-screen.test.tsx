import React from "react";
import { StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { themeFor } from "@stable/design-tokens";
import type {
  ClubContextReader,
  ClubSummary,
  Principal,
} from "@stable/contracts";

import { CurrentClubContextScreen } from "./current-club-context-screen";
import { loadCurrentClubContext } from "./load-current-club-context";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clubId = "11111111-1111-4111-8111-111111111111";
const theme = themeFor("mustangs");

const mustangs: ClubSummary = {
  id: clubId,
  name: "Mentone Mustangs",
  slug: "mentone-mustangs",
  timezone: "Australia/Melbourne",
  themeKey: "mustangs",
};

function renderScreen(
  principal: Principal | null,
  reader: ClubContextReader,
): Promise<void> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CurrentClubContextScreen
        loadContext={() => loadCurrentClubContext({ principal, reader })}
      />
    </QueryClientProvider>,
  ).then(() => undefined);
}

describe("current club context screen", () => {
  it("shows the club name, display name, and club.read for a member", async () => {
    const principal: Principal = {
      userId,
      displayName: "Ada Lovelace",
    };
    const reader: ClubContextReader = {
      read: async () => ({
        displayName: "Ada Lovelace",
        memberships: [
          {
            clubId,
            role: "CLUB_ADMIN",
            active: true,
            club: mustangs,
          },
        ],
        teamMemberships: [],
        guardianLinks: [],
        registrations: [],
        teams: [],
        clubs: [],
      }),
    };

    await renderScreen(principal, reader);

    expect(await screen.findByText("Mentone Mustangs")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("club.read")).toBeTruthy();
    expect(screen.getByText("Managed players: 0")).toBeTruthy();

    const refresh = screen.getByRole("button", { name: "Refresh club" });
    const style = StyleSheet.flatten(refresh.props.style);
    expect(style.backgroundColor).toBe(theme.color.brand.accent);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it("shows the no-membership state for an outsider", async () => {
    const principal: Principal = { userId };
    const reader: ClubContextReader = {
      read: async () => ({
        displayName: "Outsider Person",
        memberships: [],
        teamMemberships: [],
        guardianLinks: [],
        registrations: [],
        teams: [],
        clubs: [],
      }),
    };

    await renderScreen(principal, reader);

    expect(await screen.findByText("No club membership")).toBeTruthy();
    expect(screen.queryByText("Mentone Mustangs")).toBeNull();
    expect(screen.queryByText("club.read")).toBeNull();
  });

  it("exposes an accessible busy status while loading", async () => {
    const principal: Principal = { userId };
    const reader: ClubContextReader = {
      read: () => new Promise(() => undefined),
    };

    await renderScreen(principal, reader);

    expect(screen.getByRole("progressbar", { busy: true })).toBeTruthy();
    expect(screen.getByLabelText("Loading club")).toBeTruthy();
  });

  it("asks an unauthenticated person to sign in", async () => {
    const reader: ClubContextReader = {
      read: async () => ({
        displayName: "Nobody",
        memberships: [],
        teamMemberships: [],
        guardianLinks: [],
        registrations: [],
        teams: [],
        clubs: [],
      }),
    };

    await renderScreen(null, reader);

    expect(await screen.findByText("Sign in to see your club.")).toBeTruthy();
  });

  it("offers a next step when club context cannot be read", async () => {
    const reader: ClubContextReader = {
      read: async () => {
        throw new Error("database unavailable");
      },
    };

    await renderScreen({ userId }, reader);

    expect(
      await screen.findByText("Club context could not be read."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("reloads after a recoverable context failure", async () => {
    let calls = 0;
    const reader: ClubContextReader = {
      read: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("temporarily unavailable");
        }
        return {
          displayName: "Ada Lovelace",
          memberships: [
            { clubId, role: "CLUB_ADMIN", active: true, club: mustangs },
          ],
          teamMemberships: [],
          guardianLinks: [],
          registrations: [],
          teams: [],
          clubs: [],
        };
      },
    };
    await renderScreen({ userId }, reader);

    await userEvent.press(
      await screen.findByRole("button", { name: "Try again" }),
    );
    expect(await screen.findByText("Mentone Mustangs")).toBeTruthy();
    expect(calls).toBe(2);
  });

  it("shows the only team and a managed-player count without child names", async () => {
    const teamId = "17171717-1717-4717-8717-171717171717";
    const playerId = "18181818-1818-4818-8818-181818181818";
    const principal: Principal = { userId, displayName: "Coach Person" };
    const reader: ClubContextReader = {
      read: async () => ({
        displayName: "Coach Person",
        memberships: [],
        teamMemberships: [
          {
            clubId,
            teamId,
            role: "HEAD_COACH",
            active: true,
            teamActive: true,
          },
        ],
        guardianLinks: [
          {
            clubId,
            playerId,
            active: true,
            playerActive: true,
          },
        ],
        registrations: [
          {
            clubId,
            teamId,
            playerId,
            active: true,
            teamActive: true,
          },
        ],
        teams: [
          {
            id: teamId,
            name: "U14 Boys",
            clubId,
            active: true,
          },
        ],
        clubs: [mustangs],
      }),
    };

    await renderScreen(principal, reader);

    expect(await screen.findByText("U14 Boys")).toBeTruthy();
    expect(screen.getByText("Managed players: 1")).toBeTruthy();
    expect(screen.queryByText(playerId)).toBeNull();
  });

  it("lists every available team when more than one is eligible", async () => {
    const teamA = "17171717-1717-4717-8717-171717171717";
    const teamB = "17171717-1717-4717-8717-171717171718";
    const principal: Principal = { userId };
    const reader: ClubContextReader = {
      read: async () => ({
        displayName: "Coach Person",
        memberships: [],
        teamMemberships: [
          {
            clubId,
            teamId: teamB,
            role: "ASSISTANT_COACH",
            active: true,
            teamActive: true,
          },
          {
            clubId,
            teamId: teamA,
            role: "HEAD_COACH",
            active: true,
            teamActive: true,
          },
        ],
        guardianLinks: [],
        registrations: [],
        teams: [
          { id: teamB, name: "U16 Boys", clubId, active: true },
          { id: teamA, name: "U14 Boys", clubId, active: true },
        ],
        clubs: [mustangs],
      }),
    };

    await renderScreen(principal, reader);

    expect(await screen.findByText("U14 Boys")).toBeTruthy();
    expect(screen.getByText("U16 Boys")).toBeTruthy();
    expect(screen.getByText("Managed players: 0")).toBeTruthy();
  });
});
