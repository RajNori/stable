import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import type { GameDayProjection } from "@stable/game-day";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
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
  fillInLabel: null,
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

    expect(
      await screen.findByRole("header", { name: "Round 1: Visitors" }),
    ).toBeTruthy();
    expect(screen.getByText("RSVP UNANSWERED")).toBeTruthy();
    expect(screen.getByText("Duty Scorebook")).toBeTruthy();
    expect(screen.queryByText(/Attending/)).toBeNull();
  });

  it("saves the online read and shows that snapshot when offline", async () => {
    const store = memoryGameDaySnapshotStore();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
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
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    let contextCalls = 0;
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
          now={Date.parse("2026-10-07T01:30:00.000Z")}
        />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText(
        "Offline · Last updated 2026-10-07T01:00:00.000Z",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(contextCalls).toBe(0);
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
        "Offline · Last updated 2026-10-07T01:00:00.000Z",
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

  it("does not show a snapshot when there is no local session", async () => {
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

  it("does not open user A's game day for user B after sign-out cleanup", async () => {
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
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
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
        "Offline · Last updated 2026-10-07T01:00:00.000Z",
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
        "Offline · Last updated 2026-10-07T01:00:00.000Z",
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
        "Offline · Last updated 2026-10-07T01:00:00.000Z",
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
}: ScreenInput) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
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
        {...(store === undefined ? {} : { snapshotStore: store })}
        {...(localUserId === undefined ? {} : { localUserId })}
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
  online?: boolean | null;
  now?: number;
  loadContext?: () => Promise<CurrentClubContext>;
  loadGameDay?: (teamId: string) => Promise<GameDayProjection | null>;
};
