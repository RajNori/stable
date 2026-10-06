import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import type { GameDayProjection } from "@stable/game-day";

import {
  gameDaySnapshotFromProjection,
  memoryGameDaySnapshotStore,
  readGameDaySnapshot,
  type GameDaySnapshotStore,
} from "./game-day-snapshot";
import {
  clearStoredOfflineGameDay,
  isOfflineAuthorizationFailure,
  persistOfflineGameDay,
  readOfflineContextPointer,
  readOfflineGameDay,
  removeObsoleteOfflineGameDay,
} from "./offline-context";

const userId = "19191919-1919-4919-8919-191919191919";
const otherUserId = "28282828-2828-4828-8828-282828282828";
const teamId = "99999999-9999-4999-8999-999999999999";
const otherTeamId = "88888888-8888-4888-8888-888888888888";
const savedAt = "2026-10-07T01:00:00.000Z";

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
  ownDutyLabel: null,
  ownDutyStatus: null,
  attendingCount: null,
  unavailableCount: null,
  unsureCount: null,
  unansweredCount: null,
};

function snapshotFor(owner: string, team: string, opponent = "Visitors") {
  return gameDaySnapshotFromProjection({
    userId: owner,
    teamName: "U14 Boys",
    projection: { ...projection, teamId: team, opponentName: opponent },
    savedAt,
  });
}

function contextFor(
  teams: { id: string; name: string }[],
  active: { id: string; name: string } | null,
): CurrentClubContext {
  return {
    userId,
    displayName: "Local Guardian",
    club: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Mentone Mustangs",
      slug: "mentone-mustangs",
      timezone: "Australia/Melbourne",
      themeKey: "mustangs",
    },
    activeTeam: active,
    availableTeams: teams,
    capabilities: ["club.read"],
    managedPlayerIds: [],
  };
}

function recordingStore(inner: GameDaySnapshotStore): {
  reads: string[];
  writes: string[];
  store: GameDaySnapshotStore;
} {
  const reads: string[] = [];
  const writes: string[] = [];
  return {
    reads,
    writes,
    store: {
      getItem: (key) => {
        reads.push(key);
        return inner.getItem(key);
      },
      setItem: (key, value) => {
        writes.push(key);
        return inner.setItem(key, value);
      },
      removeItem: (key) => {
        writes.push(`remove:${key}`);
        return inner.removeItem(key);
      },
    },
  };
}

describe("offline game day locator", () => {
  it("writes the snapshot before the pointer and stores only user and team", async () => {
    const inner = memoryGameDaySnapshotStore();
    const recorded = recordingStore(inner);
    const order: string[] = [];
    const store: GameDaySnapshotStore = {
      getItem: recorded.store.getItem,
      removeItem: recorded.store.removeItem,
      setItem: async (key, value) => {
        if (key.startsWith("stable.offline-context.")) {
          const saved = await inner.getItem(
            `stable.game-day.v1.${userId}.${teamId}`,
          );
          if (saved === null) {
            throw new Error("pointer before snapshot");
          }
        }
        order.push(key);
        await recorded.store.setItem(key, value);
      },
    };

    await persistOfflineGameDay(store, snapshotFor(userId, teamId));

    const pointer = await readOfflineContextPointer(inner, userId);
    expect(pointer).toEqual({ version: 1, userId, teamId });
    expect(Object.keys(pointer ?? {}).includes("capabilities")).toBe(false);
    expect(Object.keys(pointer ?? {}).includes("privateNote")).toBe(false);
    expect(order[0]).toBe(`stable.game-day.v1.${userId}.${teamId}`);
    expect(order.includes(`stable.offline-context.v1.${userId}`)).toBe(true);
  });

  it("does not write a pointer when the snapshot write fails", async () => {
    const inner = memoryGameDaySnapshotStore();
    const store: GameDaySnapshotStore = {
      getItem: (key) => inner.getItem(key),
      removeItem: (key) => inner.removeItem(key),
      setItem: (key, value) => {
        if (key.startsWith("stable.game-day.")) {
          return Promise.reject(new Error("disk"));
        }
        return inner.setItem(key, value);
      },
    };

    let message = "";
    try {
      await persistOfflineGameDay(store, snapshotFor(userId, teamId));
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toBe("disk");
    expect(await readOfflineContextPointer(inner, userId)).toBeNull();
  });

  it("fails closed when the pointer has no snapshot", async () => {
    const store = memoryGameDaySnapshotStore();
    await store.setItem(
      `stable.offline-context.v1.${userId}`,
      JSON.stringify({ version: 1, userId, teamId }),
    );
    expect(await readOfflineGameDay(store, userId)).toBeNull();
  });

  it("fails closed for a malformed pointer, a bad version, or a team mismatch", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(store, snapshotFor(userId, teamId));
    await store.setItem(
      `stable.offline-context.v1.${userId}`,
      JSON.stringify({
        version: 1,
        userId,
        teamId,
        capabilities: ["club.read"],
      }),
    );
    expect(await readOfflineGameDay(store, userId)).toBeNull();

    await store.setItem(
      `stable.offline-context.v1.${userId}`,
      JSON.stringify({ version: 2, userId, teamId }),
    );
    expect(await readOfflineContextPointer(store, userId)).toBeNull();

    await store.setItem(
      `stable.offline-context.v1.${userId}`,
      JSON.stringify({ version: 1, userId, teamId: otherTeamId }),
    );
    expect(await readOfflineGameDay(store, userId)).toBeNull();
    expect(await readGameDaySnapshot(store, userId, teamId)).not.toBeNull();
  });

  it("does not read another user's snapshot", async () => {
    const inner = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(inner, snapshotFor(userId, teamId, "Visitors"));
    await persistOfflineGameDay(
      inner,
      snapshotFor(otherUserId, teamId, "Other side"),
    );
    const recorded = recordingStore(inner);
    expect(await readOfflineGameDay(recorded.store, otherUserId)).toEqual(
      snapshotFor(otherUserId, teamId, "Other side"),
    );
    expect(recorded.reads.some((key) => key.includes(userId))).toBe(false);
  });

  it("clears the snapshot and pointer on sign-out without touching the other user", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(store, snapshotFor(userId, teamId));
    await persistOfflineGameDay(
      store,
      snapshotFor(otherUserId, teamId, "Other"),
    );
    await clearStoredOfflineGameDay(store, userId);
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();
    expect(await readOfflineContextPointer(store, userId)).toBeNull();
    expect(await readOfflineGameDay(store, otherUserId)).toEqual(
      snapshotFor(otherUserId, teamId, "Other"),
    );
  });

  it("deletes the stored team when authoritative context no longer permits it", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(store, snapshotFor(userId, teamId));
    await removeObsoleteOfflineGameDay(
      store,
      userId,
      contextFor([{ id: otherTeamId, name: "U16 Boys" }], {
        id: otherTeamId,
        name: "U16 Boys",
      }),
    );
    expect(await readOfflineContextPointer(store, userId)).toBeNull();
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();
  });

  it("keeps the pointer when the stored team is still permitted", async () => {
    const store = memoryGameDaySnapshotStore();
    await persistOfflineGameDay(store, snapshotFor(userId, teamId));
    await removeObsoleteOfflineGameDay(
      store,
      userId,
      contextFor(
        [
          { id: teamId, name: "U14 Boys" },
          { id: otherTeamId, name: "U16 Boys" },
        ],
        null,
      ),
    );
    expect(await readOfflineContextPointer(store, userId)).toEqual({
      version: 1,
      userId,
      teamId,
    });
  });

  it("does not treat a transport failure as lost access", () => {
    expect(isOfflineAuthorizationFailure(new Error("offline"))).toBe(false);
    expect(
      isOfflineAuthorizationFailure(
        new ApplicationError("INTERNAL", "Game day could not be read."),
      ),
    ).toBe(false);
    expect(
      isOfflineAuthorizationFailure(
        new ApplicationError("FORBIDDEN", "This game day is not available."),
      ),
    ).toBe(true);
  });
});
