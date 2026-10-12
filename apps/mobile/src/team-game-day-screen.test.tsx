import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import type { GameDayProjection } from "@stable/game-day";
import type { DutySwapRecord } from "@stable/game-day";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import {
  gameDaySnapshotFromProjection,
  memoryGameDaySnapshotStore,
  readGameDaySnapshot,
  type GameDaySnapshotStore,
} from "./game-day-snapshot";
import {
  clearStoredOfflineGameDay,
  persistOfflineGameDay,
  readOfflineContextPointer,
  readOfflineGameDay,
} from "./offline-context";
import { TeamGameDayScreen } from "./team-game-day-screen";
import type { MobileRsvpChoice } from "./load-mobile-rsvp";
import type { MobileFillInProjection } from "./load-mobile-fill-in";

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
  fixtureSource: "MANUAL",
  fixtureStatus: "SCHEDULED",
  officialStartAt: "2026-10-10T07:30:00.000Z",
  arrivalAt: null,
  venueText: null,
  courtLabel: null,
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

describe("team game day screen", () => {
  it("shows the caller's RSVP and duty without staff counts", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamGameDayScreen
          loadContext={() => Promise.resolve(context)}
          loadGameDay={() => Promise.resolve(projection)}
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("header", { name: "Round 1: Visitors" }),
    ).toBeTruthy();
    expect(screen.getByText("RSVP UNANSWERED")).toBeTruthy();
    expect(screen.getByText("Duty Scorebook")).toBeTruthy();
    expect(screen.queryByText("Fixture Manual · scheduled")).toBeNull();
    expect(screen.queryByText(/Attending/)).toBeNull();
  });

  it("shows focus, uniform, and readiness after the exact-team coach check", async () => {
    await renderScreen({
      loadContext: () => Promise.resolve(context),
      loadGameDay: () =>
        Promise.resolve({
          ...projection,
          uniformNote: "White",
          coachFocus: "Protect the paint",
          fixtureSource: "IMPORT",
          fixtureStatus: "POSTPONED",
          attendingCount: 8,
          unavailableCount: 1,
          unsureCount: 2,
          unansweredCount: 3,
        }),
      canReadCoachGameDay: (requestedTeamId) =>
        Promise.resolve(requestedTeamId === teamId),
    });

    expect(
      await screen.findByRole("header", { name: "Coach game context" }),
    ).toBeTruthy();
    expect(screen.getByText("Team focus Protect the paint")).toBeTruthy();
    expect(screen.getByText("Fixture Imported · postponed")).toBeTruthy();
    expect(screen.getByText("Uniform White")).toBeTruthy();
    expect(
      screen.getByText(
        "Team readiness: attending 8, unavailable 1, unsure 2, unanswered 3",
      ),
    ).toBeTruthy();
  });

  it("hides the coach view when exact-team authorization is denied", async () => {
    await renderScreen({
      loadContext: () => Promise.resolve(context),
      loadGameDay: () =>
        Promise.resolve({
          ...projection,
          coachFocus: "Protect the paint",
          attendingCount: 8,
        }),
      canReadCoachGameDay: () => Promise.resolve(false),
    });

    await screen.findByRole("header", { name: "Round 1: Visitors" });
    expect(
      screen.queryByRole("header", { name: "Coach game context" }),
    ).toBeNull();
    expect(screen.queryByText("Team focus Protect the paint")).toBeNull();
  });

  it("submits the selected managed player's RSVP only after online reads land", async () => {
    const saved: Array<{
      teamId: string;
      eventId: string;
      playerId: string;
      status: string;
    }> = [];
    const choice: MobileRsvpChoice = {
      playerId: "88888888-8888-4888-8888-888888888888",
      name: "Jamie S.",
      status: "UNANSWERED",
    };
    await renderScreen({
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => Promise.resolve(projection),
      loadRsvpChoices: () => Promise.resolve([choice]),
      saveRsvp: (input) => {
        saved.push(input);
        return Promise.resolve();
      },
    });

    fireEvent.press(
      await screen.findByRole("button", { name: "Jamie S.: attending" }),
    );
    await waitFor(() =>
      expect(saved).toEqual([
        {
          teamId,
          eventId: projection.eventId,
          playerId: choice.playerId,
          status: "ATTENDING",
        },
      ]),
    );
  });

  it("lets a Guardian respond to an open fill-in request for a managed player", async () => {
    const response: Array<{
      teamId: string;
      requestId: string;
      playerId: string;
    }> = [];
    const player = {
      playerId: "88888888-8888-4888-8888-888888888888",
      displayName: "Jamie S.",
    };
    const options: MobileFillInProjection = {
      request: { id: "77777777-7777-4777-8777-777777777777", status: "OPEN" },
      players: [player],
    };
    await renderScreen({
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => Promise.resolve(projection),
      loadFillInOptions: () => Promise.resolve(options),
      respondFillIn: (input) => {
        response.push(input);
        return Promise.resolve();
      },
    });

    fireEvent.press(
      await screen.findByRole("button", { name: "Respond for Jamie S." }),
    );
    await waitFor(() =>
      expect(response).toEqual([
        {
          teamId,
          requestId: options.request?.id,
          playerId: player.playerId,
        },
      ]),
    );
    expect(
      await screen.findByText("Response saved. Team staff will confirm."),
    ).toBeTruthy();
  });

  it("acknowledges an assigned duty and accepts an eligible open swap", async () => {
    const acknowledged: Array<{ teamId: string; eventId: string }> = [];
    const requested: Array<{ teamId: string; eventId: string }> = [];
    const accepted: Array<{ teamId: string; requestId: string }> = [];
    const swap = {
      id: "77777777-7777-4777-8777-777777777777",
      label: "Scorebook",
      requesterUserId: "29292929-2929-4929-8929-292929292929",
      targetUserId: null,
    };
    await renderScreen({
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => Promise.resolve(projection),
      loadDutySwaps: () => Promise.resolve([swap]),
      acknowledgeDuty: (input) => {
        acknowledged.push(input);
        return Promise.resolve(1);
      },
      requestDutySwap: (input) => {
        requested.push(input);
        return Promise.resolve({ requestId: swap.id });
      },
      acceptDutySwap: (input) => {
        accepted.push(input);
        return Promise.resolve({ requestId: input.requestId });
      },
    });

    fireEvent.press(
      await screen.findByRole("button", { name: "Acknowledge my duty" }),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Request an open duty swap" }),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Accept swap for Scorebook" }),
    );

    await waitFor(() => {
      expect(acknowledged).toEqual([{ teamId, eventId: projection.eventId }]);
      expect(requested).toEqual([{ teamId, eventId: projection.eventId }]);
      expect(accepted).toEqual([{ teamId, requestId: swap.id }]);
    });
    expect(screen.queryByText(swap.requesterUserId)).toBeNull();
  });

  it("shows fallbacks for omitted game labels and a guardian-safe count summary", async () => {
    const nextGame: GameDayProjection = {
      ...projection,
      roundLabel: null,
      ownDutyLabel: null,
      fillInLabel: null,
      attendingCount: 4,
      unansweredCount: 2,
    };
    await renderScreen({
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => Promise.resolve(nextGame),
    });

    expect(
      await screen.findByRole("header", { name: "Game: Visitors" }),
    ).toBeTruthy();
    expect(screen.getByText("Duty None")).toBeTruthy();
    expect(screen.getByText("Fill-in None")).toBeTruthy();
    expect(screen.getByText("Attending 4, unanswered 2")).toBeTruthy();
  });

  it("shows an empty state when the active team has no game day", async () => {
    await renderScreen({
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => Promise.resolve(null),
    });

    expect(await screen.findByText("No game day yet.")).toBeTruthy();
  });

  it("clears a previous offline snapshot after an authoritative empty refresh", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );

    await renderScreen({
      store,
      localUserId: context.userId,
      online: true,
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => Promise.resolve(null),
    });

    expect(await screen.findByText("No game day yet.")).toBeTruthy();
    await waitFor(async () => {
      expect(
        await readGameDaySnapshot(store, context.userId, teamId),
      ).toBeNull();
      expect(await readOfflineContextPointer(store, context.userId)).toBeNull();
    });
    expect(screen.queryByText(/Visitors/)).toBeNull();
  });

  it("saves the online read and shows that snapshot when offline", async () => {
    const store = memoryGameDaySnapshotStore();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <TeamGameDayScreen
          loadContext={() => Promise.resolve(context)}
          loadGameDay={() => Promise.resolve(projection)}
          snapshotStore={store}
          now={Date.parse("2026-10-07T01:00:00.000Z")}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Round 1: Visitors")).toBeTruthy();
    const saved = await readGameDaySnapshot(store, context.userId, teamId);
    expect(saved?.opponentName).toBe("Visitors");
    expect(saved?.savedAt).toBe("2026-10-07T01:00:00.000Z");
    expect(saved === null || Object.keys(saved).includes("privateNote")).toBe(
      false,
    );

    expect(await readOfflineContextPointer(store, context.userId)).toEqual({
      version: 1,
      userId: context.userId,
      teamId,
    });

    const offlineClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    let contextCalls = 0;
    let loadOfflineRsvpCalled = false;
    let saveOfflineRsvpCalled = false;
    await render(
      <QueryClientProvider client={offlineClient}>
        <TeamGameDayScreen
          loadContext={() => {
            contextCalls += 1;
            return Promise.reject(new Error("offline"));
          }}
          loadGameDay={() => Promise.reject(new Error("offline"))}
          snapshotStore={store}
          localUserId={context.userId}
          online={false}
          loadRsvpChoices={() => {
            loadOfflineRsvpCalled = true;
            return Promise.resolve([]);
          }}
          saveRsvp={() => {
            saveOfflineRsvpCalled = true;
            return Promise.resolve();
          }}
          now={Date.parse("2026-10-07T01:30:00.000Z")}
        />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText(
        "Offline · Last updated Wednesday 7 October at 12:00 pm",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(contextCalls).toBe(0);
    expect(loadOfflineRsvpCalled).toBe(false);
    expect(saveOfflineRsvpCalled).toBe(false);
  });

  it("opens the saved snapshot on a cold offline launch without a context request", async () => {
    const store = memoryGameDaySnapshotStore();
    const writes: string[] = [];
    const watched = watchStore(store, writes);
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    writes.splice(0, writes.length);
    let contextCalls = 0;
    await renderScreen({
      store: watched,
      localUserId: context.userId,
      online: false,
      now: Date.parse("2026-10-07T08:00:00.000Z"),
      loadContext: () => {
        contextCalls += 1;
        return Promise.reject(new Error("offline"));
      },
    });

    expect(
      await screen.findByText(
        "Offline · Last updated Wednesday 7 October at 12:00 pm",
      ),
    ).toBeTruthy();
    expect(screen.getByText("U14 Boys: Visitors")).toBeTruthy();
    expect(screen.getByText("This snapshot is stale.")).toBeTruthy();
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(contextCalls).toBe(0);
    expect(writes).toEqual([]);
  });

  it("shows only the explicitly selected team's offline snapshot", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    const otherTeamProjection = {
      ...projection,
      eventId: "66666666-6666-4666-8666-666666666666",
      teamId: otherTeamId,
      opponentName: "Other Visitors",
    };
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U16 Boys",
        timezone: "Australia/Melbourne",
        projection: otherTeamProjection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );

    await renderScreen({
      store,
      localUserId: context.userId,
      selectedTeamId: otherTeamId,
      online: false,
    });

    expect(
      await screen.findByText(
        "Offline · Last updated Wednesday 7 October at 12:00 pm",
      ),
    ).toBeTruthy();
    expect(screen.getByText("U16 Boys: Other Visitors")).toBeTruthy();
    expect(screen.queryByText("U14 Boys: Visitors")).toBeNull();
  });

  it("keeps the stale snapshot read-only until reconnect refresh succeeds", async () => {
    const store = memoryGameDaySnapshotStore();
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );

    let contextCalls = 0;
    let gameDayCalls = 0;
    let resolveRefresh: ((value: GameDayProjection) => void) | undefined;
    const refreshedProjection = { ...projection, opponentName: "Updated" };
    const { rerender } = await render(
      screenTree({
        client,
        store,
        localUserId: context.userId,
        online: false,
        now: Date.parse("2026-10-07T08:00:00.000Z"),
        loadContext: async () => {
          contextCalls += 1;
          return context;
        },
        loadGameDay: async () => {
          gameDayCalls += 1;
          return await new Promise<GameDayProjection>((resolve) => {
            resolveRefresh = resolve;
          });
        },
      }),
    );

    expect(await screen.findByText("U14 Boys: Visitors")).toBeTruthy();
    expect(contextCalls).toBe(0);
    expect(gameDayCalls).toBe(0);

    await rerender(
      screenTree({
        client,
        store,
        localUserId: context.userId,
        online: true,
        now: Date.parse("2026-10-07T08:00:00.000Z"),
        loadContext: async () => {
          contextCalls += 1;
          return context;
        },
        loadGameDay: async () => {
          gameDayCalls += 1;
          return await new Promise<GameDayProjection>((resolve) => {
            resolveRefresh = resolve;
          });
        },
      }),
    );

    await waitFor(() => expect(gameDayCalls).toBe(1));
    expect(contextCalls).toBe(1);
    expect(screen.getByText("U14 Boys: Visitors")).toBeTruthy();
    expect(screen.getByText("This snapshot is stale.")).toBeTruthy();
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });

    resolveRefresh?.(refreshedProjection);
    expect(
      await screen.findByRole("header", { name: "Round 1: Updated" }),
    ).toBeTruthy();
    expect(screen.queryByText("U14 Boys: Visitors")).toBeNull();
    expect(
      await readGameDaySnapshot(store, context.userId, teamId),
    ).toMatchObject({ opponentName: "Updated" });
  });

  it("does not show a snapshot when there is no local session", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    await renderScreen({ store, online: false });
    expect(
      await screen.findByText("No game day saved on this device."),
    ).toBeTruthy();
    expect(screen.queryByText("U14 Boys: Visitors")).toBeNull();
  });

  it("does not show another user's snapshot", async () => {
    const store = memoryGameDaySnapshotStore();
    const reads: string[] = [];
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    await renderScreen({
      store: {
        getItem: (key) => {
          reads.push(key);
          return store.getItem(key);
        },
        setItem: store.setItem.bind(store),
        removeItem: store.removeItem.bind(store),
      },
      localUserId: otherUserId,
      online: false,
    });
    expect(
      await screen.findByText("No game day saved on this device."),
    ).toBeTruthy();
    expect(screen.queryByText(/Visitors/)).toBeNull();
    expect(reads.some((key) => key.includes(context.userId))).toBe(false);
  });

  it("fails closed when the pointer team does not match the snapshot", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    await store.setItem(
      `stable.offline-context.v1.${context.userId}`,
      JSON.stringify({
        version: 1,
        userId: context.userId,
        teamId: otherTeamId,
      }),
    );
    await renderScreen({
      store,
      localUserId: context.userId,
      online: false,
    });
    expect(
      await screen.findByText("No game day saved on this device."),
    ).toBeTruthy();
    expect(screen.queryByText(/Visitors/)).toBeNull();
  });

  it("does not choose a team when the active team is ambiguous", async () => {
    const store = memoryGameDaySnapshotStore();
    const gameDayCalls: string[] = [];
    await renderScreen({
      store,
      localUserId: context.userId,
      online: true,
      loadContext: () =>
        Promise.resolve({
          ...context,
          activeTeam: null,
          availableTeams: [
            { id: teamId, name: "U14 Boys" },
            { id: otherTeamId, name: "U16 Boys" },
          ],
        }),
      loadGameDay: (requested) => {
        gameDayCalls.push(requested);
        return Promise.resolve(projection);
      },
    });
    expect(
      await screen.findByText("Use a context with one team."),
    ).toBeTruthy();
    expect(gameDayCalls).toEqual([]);
    expect(await readOfflineContextPointer(store, context.userId)).toBeNull();
    expect(await readGameDaySnapshot(store, context.userId, teamId)).toBeNull();
  });

  it("uses the saved team snapshot when context is permitted but not selected", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );

    await renderScreen({
      store,
      localUserId: context.userId,
      online: true,
      loadContext: () =>
        Promise.resolve({
          ...context,
          activeTeam: null,
          availableTeams: [{ id: teamId, name: "U14 Boys" }],
        }),
    });

    expect(await screen.findByText("U14 Boys: Visitors")).toBeTruthy();
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it("uses the generic safe message for a non-application context failure", async () => {
    await renderScreen({
      loadContext: () => Promise.reject(new Error("database detail")),
    });

    expect(await screen.findByText("Game day could not be read.")).toBeTruthy();
    expect(screen.queryByText("database detail")).toBeNull();
  });

  it("allows a failed Game Day read to be retried", async () => {
    let attempts = 0;
    await renderScreen({
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error("temporary transport failure"))
          : Promise.resolve(projection);
      },
    });

    expect(await screen.findByText("Game day could not be read.")).toBeTruthy();
    await userEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("header", { name: "Round 1: Visitors" }),
    ).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it("offers a refresh when the online Game Day read falls back to a snapshot", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    let attempts = 0;
    await renderScreen({
      store,
      localUserId: context.userId,
      selectedTeamId: teamId,
      online: true,
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error("temporary transport failure"))
          : Promise.resolve(projection);
      },
    });

    expect(await screen.findByText("U14 Boys: Visitors")).toBeTruthy();
    await userEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("header", { name: "Round 1: Visitors" }),
    ).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it("does not open user A's game day for user B after sign-out cleanup", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    await clearStoredOfflineGameDay(store, context.userId);
    await renderScreen({
      store,
      localUserId: otherUserId,
      online: false,
    });
    expect(
      await screen.findByText("No game day saved on this device."),
    ).toBeTruthy();
    expect(screen.queryByText(/Visitors/)).toBeNull();
    expect(await readOfflineGameDay(store, otherUserId)).toBeNull();
    expect(await readGameDaySnapshot(store, context.userId, teamId)).toBeNull();
  });

  it("replaces the snapshot only after an authoritative reconnect", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    const calls = { context: 0, gameDay: 0 };
    let releaseContext: (value: CurrentClubContext) => void = () => undefined;
    let releaseGameDay: (value: GameDayProjection) => void = () => undefined;
    const refreshed: GameDayProjection = {
      ...projection,
      opponentName: "Home Side",
      roundLabel: "Round 2",
    };
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    const view = await renderScreen({
      client,
      store,
      localUserId: context.userId,
      online: false,
      now: Date.parse("2026-10-07T02:00:00.000Z"),
      loadContext: () => {
        calls.context += 1;
        return new Promise((resolve) => {
          releaseContext = resolve;
        });
      },
      loadGameDay: () => {
        calls.gameDay += 1;
        return new Promise((resolve) => {
          releaseGameDay = resolve;
        });
      },
    });

    expect(
      await screen.findByText(
        "Offline · Last updated Wednesday 7 October at 12:00 pm",
      ),
    ).toBeTruthy();
    expect(calls.context).toBe(0);

    await view.rerender(
      screenTree({
        client,
        store,
        localUserId: context.userId,
        online: true,
        now: Date.parse("2026-10-07T02:00:00.000Z"),
        loadContext: () => {
          calls.context += 1;
          return new Promise((resolve) => {
            releaseContext = resolve;
          });
        },
        loadGameDay: () => {
          calls.gameDay += 1;
          return new Promise((resolve) => {
            releaseGameDay = resolve;
          });
        },
      }),
    );

    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
    await waitFor(() => {
      expect(calls.context).toBe(1);
    });
    expect(calls.gameDay).toBe(0);
    releaseContext(context);
    await waitFor(() => {
      expect(calls.gameDay).toBe(1);
    });
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
    releaseGameDay(refreshed);
    expect(await screen.findByText("Round 2: Home Side")).toBeTruthy();
    expect(screen.queryByText("Save RSVP")).toBeNull();
    const replaced = await readGameDaySnapshot(store, context.userId, teamId);
    expect(replaced?.opponentName).toBe("Home Side");
    expect(replaced?.savedAt).toBe("2026-10-07T02:00:00.000Z");
  });

  it("stays read-only when the reconnect refresh fails", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    await renderScreen({
      store,
      localUserId: context.userId,
      online: true,
      loadContext: () => Promise.reject(new Error("offline")),
      loadGameDay: () => Promise.reject(new Error("offline")),
    });
    expect(
      await screen.findByText(
        "Offline · Last updated Wednesday 7 October at 12:00 pm",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(await readOfflineContextPointer(store, context.userId)).toEqual({
      version: 1,
      userId: context.userId,
      teamId,
    });
  });

  it("stays read-only when the game day refresh fails after context loads", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    await renderScreen({
      store,
      localUserId: context.userId,
      online: true,
      loadContext: () => Promise.resolve(context),
      loadGameDay: () => Promise.reject(new Error("offline")),
    });
    expect(
      await screen.findByText(
        "Offline · Last updated Wednesday 7 October at 12:00 pm",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.queryByText("Round 1: Visitors")).toBeNull();
    const saved = await readGameDaySnapshot(store, context.userId, teamId);
    expect(saved?.opponentName).toBe("Visitors");
  });

  it("drops the stored team when reconnect shows access is gone", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    const gameDayCalls: string[] = [];
    await renderScreen({
      store,
      localUserId: context.userId,
      online: true,
      loadContext: () =>
        Promise.resolve({
          ...context,
          activeTeam: null,
          availableTeams: [],
        }),
      loadGameDay: (requested) => {
        gameDayCalls.push(requested);
        return Promise.resolve(projection);
      },
    });
    expect(
      await screen.findByText("Use a context with one team."),
    ).toBeTruthy();
    expect(screen.queryByText(/Visitors/)).toBeNull();
    expect(screen.queryByText("Save RSVP")).toBeNull();
    expect(gameDayCalls).toEqual([]);
    await waitFor(async () => {
      expect(await readOfflineContextPointer(store, context.userId)).toBeNull();
    });
    expect(await readGameDaySnapshot(store, context.userId, teamId)).toBeNull();
  });

  it("drops the stored team when reconnect is forbidden", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        timezone: "Australia/Melbourne",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    await renderScreen({
      store,
      localUserId: context.userId,
      online: true,
      loadContext: () =>
        Promise.reject(
          new ApplicationError("FORBIDDEN", "This game day is not available."),
        ),
    });
    expect(
      await screen.findByText("This game day is not available."),
    ).toBeTruthy();
    expect(screen.queryByText(/Visitors/)).toBeNull();
    expect(screen.queryByText("Save RSVP")).toBeNull();
    await waitFor(async () => {
      expect(await readOfflineContextPointer(store, context.userId)).toBeNull();
    });
  });

  it("does not fall back to cached data when the Game Day read is forbidden", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(
      store,
      gameDaySnapshotFromProjection({
        userId: context.userId,
        teamName: "U14 Boys",
        projection,
        savedAt: "2026-10-07T01:00:00.000Z",
      }),
    );
    await renderScreen({
      store,
      localUserId: context.userId,
      online: true,
      loadContext: () => Promise.resolve(context),
      loadGameDay: () =>
        Promise.reject(
          new ApplicationError("FORBIDDEN", "This game day is not available."),
        ),
    });

    expect(
      await screen.findByText("This game day is not available."),
    ).toBeTruthy();
    expect(screen.queryByText(/Visitors/)).toBeNull();
    await waitFor(async () => {
      expect(
        await readGameDaySnapshot(store, context.userId, teamId),
      ).toBeNull();
      expect(await readOfflineContextPointer(store, context.userId)).toBeNull();
    });
  });
});

const otherUserId = "28282828-2828-4828-8828-282828282828";
const otherTeamId = "88888888-8888-4888-8888-888888888888";

function watchStore(
  inner: GameDaySnapshotStore,
  writes: string[],
): GameDaySnapshotStore {
  return {
    getItem: (key) => inner.getItem(key),
    setItem: (key, value) => {
      writes.push(key);
      return inner.setItem(key, value);
    },
    removeItem: (key) => {
      writes.push(`remove:${key}`);
      return inner.removeItem(key);
    },
  };
}

function renderScreen(input: ScreenInput) {
  return render(screenTree(input));
}

function screenTree({
  client,
  store,
  localUserId,
  online,
  now,
  loadContext,
  loadGameDay,
  selectedTeamId,
  canReadCoachGameDay,
  loadRsvpChoices,
  saveRsvp,
  loadFillInOptions,
  respondFillIn,
  loadDutySwaps,
  acknowledgeDuty,
  requestDutySwap,
  acceptDutySwap,
}: ScreenInput) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
  return (
    <QueryClientProvider client={queryClient}>
      <TeamGameDayScreen
        loadContext={
          loadContext ?? (() => Promise.reject(new Error("offline")))
        }
        loadGameDay={
          loadGameDay ?? (() => Promise.reject(new Error("offline")))
        }
        {...(canReadCoachGameDay === undefined ? {} : { canReadCoachGameDay })}
        {...(loadRsvpChoices === undefined ? {} : { loadRsvpChoices })}
        {...(saveRsvp === undefined ? {} : { saveRsvp })}
        {...(loadFillInOptions === undefined ? {} : { loadFillInOptions })}
        {...(respondFillIn === undefined ? {} : { respondFillIn })}
        {...(loadDutySwaps === undefined ? {} : { loadDutySwaps })}
        {...(acknowledgeDuty === undefined ? {} : { acknowledgeDuty })}
        {...(requestDutySwap === undefined ? {} : { requestDutySwap })}
        {...(acceptDutySwap === undefined ? {} : { acceptDutySwap })}
        {...(store === undefined ? {} : { snapshotStore: store })}
        {...(localUserId === undefined ? {} : { localUserId })}
        {...(selectedTeamId === undefined ? {} : { selectedTeamId })}
        {...(online === undefined ? {} : { online })}
        now={now ?? Date.parse("2026-10-07T01:30:00.000Z")}
      />
    </QueryClientProvider>
  );
}

type ScreenInput = {
  client?: QueryClient;
  store?: GameDaySnapshotStore;
  localUserId?: string;
  selectedTeamId?: string | null;
  online?: boolean | null;
  now?: number;
  loadContext?: () => Promise<CurrentClubContext>;
  loadGameDay?: (teamId: string) => Promise<GameDayProjection | null>;
  canReadCoachGameDay?: (teamId: string) => Promise<boolean>;
  loadRsvpChoices?: (
    teamId: string,
    eventId: string,
  ) => Promise<readonly MobileRsvpChoice[]>;
  saveRsvp?: (input: {
    teamId: string;
    eventId: string;
    playerId: string;
    status: "ATTENDING" | "UNAVAILABLE" | "UNSURE";
  }) => Promise<void>;
  loadFillInOptions?: (
    teamId: string,
    eventId: string,
  ) => Promise<MobileFillInProjection>;
  respondFillIn?: (input: {
    teamId: string;
    requestId: string;
    playerId: string;
  }) => Promise<void>;
  loadDutySwaps?: (
    teamId: string,
    eventId: string,
  ) => Promise<readonly DutySwapRecord[]>;
  acknowledgeDuty?: (input: {
    teamId: string;
    eventId: string;
  }) => Promise<number>;
  requestDutySwap?: (input: {
    teamId: string;
    eventId: string;
  }) => Promise<unknown>;
  acceptDutySwap?: (input: {
    teamId: string;
    requestId: string;
  }) => Promise<unknown>;
};
