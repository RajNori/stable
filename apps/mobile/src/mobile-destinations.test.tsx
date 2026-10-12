import React from "react";
import { Pressable, Text } from "react-native";
import { render, screen, userEvent } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CurrentClubContext } from "@stable/contracts";
import { useState } from "react";

import { MobileDestinations } from "./mobile-destinations";

function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

describe("mobile destinations", () => {
  it("keeps home, schedule, team, updates, and profile on one tab bar", async () => {
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <MobileDestinations
          home={<Text>Mentone Mustangs</Text>}
          schedule={<Text>Training at Tuesday</Text>}
          team={<Text>Alexander R.</Text>}
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Schedule")).toBeTruthy();
    expect(screen.getByText("Team")).toBeTruthy();
    expect(screen.getByText("Updates")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("Mentone Mustangs")).toBeTruthy();
    expect(
      screen.getByTestId("mobile-destination-content").props.scrollEnabled,
    ).toBe(true);

    await user.press(screen.getByRole("tab", { name: "Team" }));
    expect(screen.getByText("Alexander R.")).toBeTruthy();
    expect(screen.queryByText("Mentone Mustangs")).toBeNull();

    await user.press(screen.getByRole("tab", { name: "Schedule" }));
    expect(screen.getByText("Training at Tuesday")).toBeTruthy();
    expect(screen.queryByText("Alexander R.")).toBeNull();

    await user.press(screen.getByRole("tab", { name: "Updates" }));
    expect(screen.getByText("Updates is not available yet.")).toBeTruthy();

    await user.press(screen.getByRole("tab", { name: "Profile" }));
    expect(screen.getByText("Profile is not available yet.")).toBeTruthy();
  });

  it("lets the Home projection open Schedule", async () => {
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <MobileDestinations
          home={(navigate) => (
            <Text onPress={() => navigate("Schedule")}>Next game</Text>
          )}
          schedule={<Text>Schedule destination</Text>}
          team={<Text>Team destination</Text>}
        />
      </QueryClientProvider>,
    );
    await userEvent.press(screen.getByText("Next game"));
    expect(screen.getByText("Schedule destination")).toBeTruthy();
  });

  it("limits context switching to server-returned teams and reloads scoped content", async () => {
    const clubId = "11111111-1111-4111-8111-111111111111";
    const teamA = "99999999-9999-4999-8999-999999999991";
    const teamB = "99999999-9999-4999-8999-999999999992";
    const context: CurrentClubContext = {
      userId: "19191919-1919-4919-8919-191919191919",
      displayName: "Guardian",
      club: {
        id: clubId,
        name: "Club",
        slug: "club",
        timezone: "Australia/Melbourne",
        themeKey: "mustangs",
      },
      activeTeam: null,
      availableTeams: [
        { id: teamA, name: "U12" },
        { id: teamB, name: "U14" },
      ],
      capabilities: ["club.read"],
      managedPlayerIds: [],
    };
    function ContextHome({
      loadContext,
    }: {
      loadContext: () => Promise<CurrentClubContext>;
    }) {
      const [teamName, setTeamName] = useState("No team selected");
      return (
        <>
          <Text>{teamName}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Read selected team"
            onPress={() => {
              void loadContext().then((value) => {
                setTeamName(value.activeTeam?.name ?? "No team selected");
              });
            }}
          >
            <Text>Read selected team</Text>
          </Pressable>
        </>
      );
    }
    const selectedTeams: string[] = [];
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <MobileDestinations
          loadContext={() => Promise.resolve(context)}
          onTeamSelected={async (selectedTeamId) => {
            selectedTeams.push(selectedTeamId);
          }}
          home={(_navigate, loadContext) => (
            <ContextHome loadContext={loadContext} />
          )}
          schedule={<Text>Schedule destination</Text>}
          team={<Text>Team destination</Text>}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No team selected")).toBeTruthy();
    await userEvent.press(await screen.findByRole("radio", { name: "U14" }));
    await userEvent.press(
      screen.getByRole("button", { name: "Read selected team" }),
    );
    expect((await screen.findAllByText("U14")).length).toBe(2);
    expect(
      screen.getByRole("radio", { name: "U14" }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(screen.queryByRole("radio", { name: teamB })).toBeNull();
    expect(selectedTeams).toEqual([teamB]);
  });

  it("fails closed and reports when team selection persistence fails", async () => {
    const context: CurrentClubContext = {
      userId: "19191919-1919-4919-8919-191919191919",
      displayName: "Guardian",
      club: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Club",
        slug: "club",
        timezone: "Australia/Melbourne",
        themeKey: "mustangs",
      },
      activeTeam: null,
      availableTeams: [
        { id: "99999999-9999-4999-8999-999999999991", name: "U12" },
        { id: "99999999-9999-4999-8999-999999999992", name: "U14" },
      ],
      capabilities: ["club.read"],
      managedPlayerIds: [],
    };
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <MobileDestinations
          loadContext={() => Promise.resolve(context)}
          onTeamSelected={() => Promise.reject(new Error("secure storage"))}
          home={<Text>Home</Text>}
          schedule={<Text>Schedule</Text>}
          team={<Text>Team</Text>}
        />
      </QueryClientProvider>,
    );

    await userEvent.press(await screen.findByRole("radio", { name: "U14" }));

    expect(
      await screen.findByText(
        "Could not save the team selection. Choose it again when online.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "U12" }).props.accessibilityState,
    ).toMatchObject({ checked: false });
    expect(
      screen.getByRole("radio", { name: "U14" }).props.accessibilityState,
    ).toMatchObject({ checked: false });
  });
});
