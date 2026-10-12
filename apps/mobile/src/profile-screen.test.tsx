import type { CurrentClubContext } from "@stable/contracts";
import type { NotificationPreference } from "@stable/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import { ProfileScreen } from "./profile-screen";

const context: CurrentClubContext = {
  userId: "19191919-1919-4919-8919-191919191919",
  displayName: "Casey Sample",
  club: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Mentone Mustangs",
    slug: "mentone-mustangs",
    timezone: "Australia/Melbourne",
    themeKey: "mustangs",
  },
  activeTeam: {
    id: "99999999-9999-4999-8999-999999999999",
    name: "U14 Boys",
  },
  availableTeams: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      name: "U14 Boys",
    },
  ],
  capabilities: ["club.read"],
  managedPlayerIds: ["88888888-8888-4888-8888-888888888888"],
};

function queryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

function renderProfile(
  input: {
    loadPreferences?: () => Promise<NotificationPreference[]>;
    savePreference?: (value: NotificationPreference) => Promise<void>;
  } = {},
) {
  return render(
    <QueryClientProvider client={queryClient()}>
      <ProfileScreen
        loadContext={() => Promise.resolve(context)}
        loadPreferences={
          input.loadPreferences ??
          (() =>
            Promise.resolve([{ category: "GAME_REMINDER", pushEnabled: true }]))
        }
        savePreference={input.savePreference ?? (() => Promise.resolve())}
      />
    </QueryClientProvider>,
  );
}

describe("ProfileScreen", () => {
  it("shows only the signed-in adult and selected club context", async () => {
    await renderProfile();

    expect(await screen.findByText("Casey Sample")).toBeTruthy();
    expect(screen.getByText("Mentone Mustangs")).toBeTruthy();
    expect(screen.getByText("U14 Boys")).toBeTruthy();
    expect(screen.getByText("Managed children: 1")).toBeTruthy();
    expect(screen.queryByText(context.managedPlayerIds[0] ?? "")).toBeNull();
  });

  it("loads a caller-owned preference and saves a change", async () => {
    const saved: NotificationPreference[] = [];
    await renderProfile({
      savePreference: (preference) => {
        saved.push(preference);
        return Promise.resolve();
      },
    });
    const control = await screen.findByRole("switch", {
      name: "Fixture changes",
    });

    expect(
      screen.getByRole("switch", { name: "Game reminders" }).props.value,
    ).toBe(true);
    await act(async () => {
      fireEvent(control, "valueChange", true);
      await waitFor(() =>
        expect(saved).toEqual([
          { category: "FIXTURE_CHANGED", pushEnabled: true },
        ]),
      );
    });
  });

  it("fails closed if preferences cannot be read", async () => {
    await renderProfile({
      loadPreferences: () =>
        Promise.reject(new Error("private provider detail")),
    });

    expect(
      await screen.findByText("Notifications could not be read."),
    ).toBeTruthy();
    expect(screen.queryByText("private provider detail")).toBeNull();
  });
});
