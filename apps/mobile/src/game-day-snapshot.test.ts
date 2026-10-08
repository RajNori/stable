import type { GameDayProjection } from "@stable/game-day";

import {
  clearUserGameDaySnapshots,
  gameDaySnapshotFromProjection,
  gameDaySnapshotFreshness,
  memoryGameDaySnapshotStore,
  readGameDaySnapshot,
  saveGameDaySnapshot,
  secureGameDaySnapshotStore,
} from "./game-day-snapshot";

declare const jest: any;

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => {
    mockSecureCalls().gets.push(key);
    return "snapshot";
  },
  setItemAsync: async (key: string, value: string) => {
    mockSecureCalls().sets.push([key, value]);
  },
  deleteItemAsync: async (key: string) => {
    mockSecureCalls().deletes.push(key);
  },
}));

type SecureStoreCalls = {
  gets: string[];
  sets: Array<[string, string]>;
  deletes: string[];
};

function mockSecureCalls(): SecureStoreCalls {
  const holder = globalThis as typeof globalThis & {
    __stableM5SecureStoreCalls?: SecureStoreCalls;
  };
  holder.__stableM5SecureStoreCalls ??= { gets: [], sets: [], deletes: [] };
  return holder.__stableM5SecureStoreCalls;
}

const userId = "19191919-1919-4919-8919-191919191919";
const otherUserId = "28282828-2828-4828-8828-282828282828";
const teamId = "99999999-9999-4999-8999-999999999999";
const savedAt = "2026-10-07T01:00:00.000Z";

const projection: GameDayProjection = {
  eventId: "55555555-5555-4555-8555-555555555555",
  clubId: "11111111-1111-4111-8111-111111111111",
  teamId,
  opponentName: "Visitors",
  roundLabel: "Round 1",
  officialStartAt: "2026-10-10T07:30:00.000Z",
  arrivalAt: "2026-10-10T07:00:00.000Z",
  venueText: "Home",
  courtLabel: "Court 1",
  uniformNote: "White",
  coachFocus: "Press",
  ownRsvp: "ATTENDING",
  ownDutyLabel: "Scorebook",
  ownDutyStatus: "ASSIGNED",
  fillInLabel: null,
  attendingCount: 3,
  unavailableCount: 1,
  unsureCount: 0,
  unansweredCount: 2,
};

describe("game day snapshot", () => {
  it("stores a fresh read-only snapshot and replaces it on refresh", async () => {
    const store = memoryGameDaySnapshotStore();
    const snapshot = gameDaySnapshotFromProjection({
      userId,
      teamName: "U14 Boys",
      projection,
      savedAt,
    });
    expect(Object.keys(snapshot).includes("privateNote")).toBe(false);
    expect(gameDaySnapshotFreshness(savedAt, Date.parse(savedAt))).toBe(
      "fresh",
    );
    await saveGameDaySnapshot(store, snapshot);
    expect(await readGameDaySnapshot(store, userId, teamId)).toEqual(snapshot);

    const refreshed = {
      ...snapshot,
      opponentName: "Updated",
      savedAt: "2026-10-07T02:00:00.000Z",
    };
    await saveGameDaySnapshot(store, refreshed);
    expect(await readGameDaySnapshot(store, userId, teamId)).toEqual(refreshed);
  });

  it("marks an old snapshot stale", () => {
    expect(
      gameDaySnapshotFreshness(savedAt, Date.parse("2026-10-07T08:00:00.000Z")),
    ).toBe("stale");
    expect(gameDaySnapshotFreshness("not-a-date", Date.parse(savedAt))).toBe(
      "stale",
    );
  });

  it("fails closed when the local snapshot index is malformed", async () => {
    const store = memoryGameDaySnapshotStore();
    await store.setItem(`stable.game-day.v1.${userId}`, '{"teams":["team",7]}');

    await clearUserGameDaySnapshots(store, userId);

    expect(await store.getItem(`stable.game-day.v1.${userId}`)).toBeNull();
  });

  it("uses SecureStore for device-only snapshot persistence", async () => {
    const adapter = secureGameDaySnapshotStore();
    expect(await adapter.getItem("key")).toBe("snapshot");
    await adapter.setItem("key", "value");
    await adapter.removeItem("key");
    expect(mockSecureCalls().gets.at(-1)).toBe("key");
    expect(mockSecureCalls().sets.at(-1)).toEqual(["key", "value"]);
    expect(mockSecureCalls().deletes.at(-1)).toBe("key");
  });

  it("rejects snapshots with invalid counts or an empty team name", async () => {
    const store = memoryGameDaySnapshotStore();
    const snapshot = gameDaySnapshotFromProjection({
      userId,
      teamName: "U14 Boys",
      projection,
      savedAt,
    });
    const key = `stable.game-day.v1.${userId}.${teamId}`;
    await store.setItem(
      key,
      JSON.stringify({ ...snapshot, attendingCount: 1.5 }),
    );
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();

    await store.setItem(key, JSON.stringify({ ...snapshot, teamName: "" }));
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();
  });

  it("rejects non-object snapshots and malformed index JSON", async () => {
    const store = memoryGameDaySnapshotStore();
    const snapshotKey = `stable.game-day.v1.${userId}.${teamId}`;
    await store.setItem(snapshotKey, "[]");
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();

    await store.setItem(`stable.game-day.v1.${userId}`, "{not-json");
    await clearUserGameDaySnapshots(store, userId);
    expect(await store.getItem(`stable.game-day.v1.${userId}`)).toBeNull();
  });

  it("clears one user without leaking another user's snapshot", async () => {
    const store = memoryGameDaySnapshotStore();
    const own = gameDaySnapshotFromProjection({
      userId,
      teamName: "U14 Boys",
      projection,
      savedAt,
    });
    const other = gameDaySnapshotFromProjection({
      userId: otherUserId,
      teamName: "U14 Boys",
      projection,
      savedAt,
    });
    await saveGameDaySnapshot(store, own);
    await saveGameDaySnapshot(store, other);
    await clearUserGameDaySnapshots(store, userId);
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();
    expect(await readGameDaySnapshot(store, otherUserId, teamId)).toEqual(
      other,
    );
  });

  it("rejects a snapshot that carries a private note", async () => {
    const store = memoryGameDaySnapshotStore();
    const snapshot = gameDaySnapshotFromProjection({
      userId,
      teamName: "U14 Boys",
      projection,
      savedAt,
    });
    await saveGameDaySnapshot(store, snapshot);
    const key = `stable.game-day.v1.${userId}.${teamId}`;
    const raw = await store.getItem(key);
    if (raw === null) {
      throw new Error("missing snapshot");
    }
    await store.setItem(
      key,
      JSON.stringify({ ...JSON.parse(raw), privateNote: "Fever" }),
    );
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();
  });

  it("fails closed for corrupt JSON and a snapshot stored under the wrong identity", async () => {
    const store = memoryGameDaySnapshotStore();
    const snapshot = gameDaySnapshotFromProjection({
      userId,
      teamName: "U14 Boys",
      projection,
      savedAt,
    });
    const key = `stable.game-day.v1.${userId}.${teamId}`;

    await store.setItem(key, "{not-json");
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();

    await store.setItem(
      key,
      JSON.stringify({ ...snapshot, userId: otherUserId }),
    );
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();

    await store.setItem(
      key,
      JSON.stringify({
        ...snapshot,
        teamId: "88888888-8888-4888-8888-888888888888",
      }),
    );
    expect(await readGameDaySnapshot(store, userId, teamId)).toBeNull();
  });
});
