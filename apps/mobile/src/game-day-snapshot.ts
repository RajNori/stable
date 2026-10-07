import type { GameDayProjection } from "@stable/game-day";
import * as SecureStore from "expo-secure-store";

export const GAME_DAY_SNAPSHOT_VERSION = 1;
export const GAME_DAY_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export type GameDaySnapshot = {
  version: 1;
  userId: string;
  teamId: string;
  teamName: string;
  opponentName: string;
  officialStartAt: string;
  arrivalAt: string | null;
  venueText: string | null;
  courtLabel: string | null;
  uniformNote: string | null;
  coachFocus: string | null;
  ownRsvp: string;
  ownDutyLabel: string | null;
  ownDutyStatus: "ASSIGNED" | null;
  fillInLabel: string | null;
  attendingCount: number | null;
  unavailableCount: number | null;
  unsureCount: number | null;
  unansweredCount: number | null;
  savedAt: string;
};

const SNAPSHOT_KEYS = [
  "version",
  "userId",
  "teamId",
  "teamName",
  "opponentName",
  "officialStartAt",
  "arrivalAt",
  "venueText",
  "courtLabel",
  "uniformNote",
  "coachFocus",
  "ownRsvp",
  "ownDutyLabel",
  "ownDutyStatus",
  "fillInLabel",
  "attendingCount",
  "unavailableCount",
  "unsureCount",
  "unansweredCount",
  "savedAt",
] as const;

export type GameDaySnapshotStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCount(value: unknown): value is number | null {
  return (
    value === null || (typeof value === "number" && Number.isInteger(value))
  );
}

function isSnapshot(value: unknown): value is GameDaySnapshot {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (
    keys.length !== SNAPSHOT_KEYS.length ||
    SNAPSHOT_KEYS.some((key) => !keys.includes(key))
  ) {
    return false;
  }
  return (
    value["version"] === GAME_DAY_SNAPSHOT_VERSION &&
    isText(value["userId"]) &&
    isText(value["teamId"]) &&
    isText(value["teamName"]) &&
    value["teamName"].length > 0 &&
    isText(value["opponentName"]) &&
    isText(value["officialStartAt"]) &&
    isNullableText(value["arrivalAt"]) &&
    isNullableText(value["venueText"]) &&
    isNullableText(value["courtLabel"]) &&
    isNullableText(value["uniformNote"]) &&
    isNullableText(value["coachFocus"]) &&
    isText(value["ownRsvp"]) &&
    isNullableText(value["ownDutyLabel"]) &&
    (value["ownDutyStatus"] === null ||
      value["ownDutyStatus"] === "ASSIGNED") &&
    isNullableText(value["fillInLabel"]) &&
    isCount(value["attendingCount"]) &&
    isCount(value["unavailableCount"]) &&
    isCount(value["unsureCount"]) &&
    isCount(value["unansweredCount"]) &&
    isText(value["savedAt"])
  );
}

export function memoryGameDaySnapshotStore(): GameDaySnapshotStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(values.get(key) ?? null),
    setItem: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      values.delete(key);
      return Promise.resolve();
    },
  };
}

export function gameDaySnapshotFromProjection(input: {
  userId: string;
  teamName: string;
  projection: GameDayProjection;
  savedAt: string;
}): GameDaySnapshot {
  return {
    version: GAME_DAY_SNAPSHOT_VERSION,
    userId: input.userId,
    teamId: input.projection.teamId,
    teamName: input.teamName,
    opponentName: input.projection.opponentName,
    officialStartAt: input.projection.officialStartAt,
    arrivalAt: input.projection.arrivalAt,
    venueText: input.projection.venueText,
    courtLabel: input.projection.courtLabel,
    uniformNote: input.projection.uniformNote,
    coachFocus: input.projection.coachFocus,
    ownRsvp: input.projection.ownRsvp,
    ownDutyLabel: input.projection.ownDutyLabel,
    ownDutyStatus: input.projection.ownDutyStatus,
    fillInLabel: input.projection.fillInLabel,
    attendingCount: input.projection.attendingCount,
    unavailableCount: input.projection.unavailableCount,
    unsureCount: input.projection.unsureCount,
    unansweredCount: input.projection.unansweredCount,
    savedAt: input.savedAt,
  };
}

export function gameDaySnapshotFreshness(
  savedAt: string,
  now: number,
): "fresh" | "stale" {
  const saved = Date.parse(savedAt);
  if (Number.isNaN(saved) || now - saved > GAME_DAY_STALE_AFTER_MS) {
    return "stale";
  }
  return "fresh";
}

export async function saveGameDaySnapshot(
  store: GameDaySnapshotStore,
  snapshot: GameDaySnapshot,
): Promise<void> {
  await store.setItem(
    snapshotKey(snapshot.userId, snapshot.teamId),
    JSON.stringify(snapshot),
  );
  const current = await readIndex(store, snapshot.userId);
  if (!current.includes(snapshot.teamId)) {
    current.push(snapshot.teamId);
  }
  await store.setItem(
    indexKey(snapshot.userId),
    JSON.stringify({ teams: current }),
  );
}

export async function readGameDaySnapshot(
  store: GameDaySnapshotStore,
  userId: string,
  teamId: string,
): Promise<GameDaySnapshot | null> {
  const raw = await store.getItem(snapshotKey(userId, teamId));
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const snapshot = isSnapshot(parsed) ? parsed : null;
  if (
    snapshot === null ||
    snapshot.userId !== userId ||
    snapshot.teamId !== teamId
  ) {
    return null;
  }
  return snapshot;
}

export async function clearUserGameDaySnapshots(
  store: GameDaySnapshotStore,
  userId: string,
): Promise<void> {
  const teams = await readIndex(store, userId);
  for (const teamId of teams) {
    await store.removeItem(snapshotKey(userId, teamId));
  }
  await store.removeItem(indexKey(userId));
}

function snapshotKey(userId: string, teamId: string): string {
  return `stable.game-day.v1.${userId}.${teamId}`;
}

function indexKey(userId: string): string {
  return `stable.game-day.v1.${userId}`;
}

export function secureGameDaySnapshotStore(): GameDaySnapshotStore {
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

async function readIndex(
  store: GameDaySnapshotStore,
  userId: string,
): Promise<string[]> {
  const raw = await store.getItem(indexKey(userId));
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed["teams"])) {
      return [];
    }
    const teams: string[] = [];
    for (const teamId of parsed["teams"]) {
      if (typeof teamId !== "string") {
        return [];
      }
      teams.push(teamId);
    }
    return teams;
  } catch {
    return [];
  }
}
