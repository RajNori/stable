import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";

import {
  clearUserGameDaySnapshots,
  readGameDaySnapshot,
  saveGameDaySnapshot,
  type GameDaySnapshot,
  type GameDaySnapshotStore,
} from "./game-day-snapshot";

export const OFFLINE_CONTEXT_VERSION = 1;

export type OfflineContextPointer = {
  version: 1;
  userId: string;
  teamId: string;
};

const POINTER_KEYS = ["version", "userId", "teamId"] as const;

function pointerKey(userId: string): string {
  return `stable.offline-context.v1.${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPointer(
  value: unknown,
  userId: string,
): value is OfflineContextPointer {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (
    keys.length !== POINTER_KEYS.length ||
    POINTER_KEYS.some((key) => !keys.includes(key))
  ) {
    return false;
  }
  return (
    value["version"] === OFFLINE_CONTEXT_VERSION &&
    value["userId"] === userId &&
    typeof value["teamId"] === "string" &&
    value["teamId"].length > 0
  );
}

export async function saveOfflineContextPointer(
  store: GameDaySnapshotStore,
  pointer: OfflineContextPointer,
): Promise<void> {
  await store.setItem(
    pointerKey(pointer.userId),
    JSON.stringify({
      version: OFFLINE_CONTEXT_VERSION,
      userId: pointer.userId,
      teamId: pointer.teamId,
    }),
  );
}

export async function readOfflineContextPointer(
  store: GameDaySnapshotStore,
  userId: string,
): Promise<OfflineContextPointer | null> {
  const raw = await store.getItem(pointerKey(userId));
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPointer(parsed, userId) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearOfflineContextPointer(
  store: GameDaySnapshotStore,
  userId: string,
): Promise<void> {
  await store.removeItem(pointerKey(userId));
}

export async function persistOfflineGameDay(
  store: GameDaySnapshotStore,
  snapshot: GameDaySnapshot,
): Promise<void> {
  await saveGameDaySnapshot(store, snapshot);
  await saveOfflineContextPointer(store, {
    version: OFFLINE_CONTEXT_VERSION,
    userId: snapshot.userId,
    teamId: snapshot.teamId,
  });
}

export async function readOfflineGameDay(
  store: GameDaySnapshotStore,
  userId: string,
): Promise<GameDaySnapshot | null> {
  const pointer = await readOfflineContextPointer(store, userId);
  if (pointer === null) {
    return null;
  }
  const snapshot = await readGameDaySnapshot(store, userId, pointer.teamId);
  if (
    snapshot === null ||
    snapshot.userId !== userId ||
    snapshot.teamId !== pointer.teamId
  ) {
    return null;
  }
  return snapshot;
}

export async function clearStoredOfflineGameDay(
  store: GameDaySnapshotStore,
  userId: string,
): Promise<void> {
  await clearUserGameDaySnapshots(store, userId);
  await clearOfflineContextPointer(store, userId);
}

export function contextPermitsTeam(
  context: CurrentClubContext,
  teamId: string,
): boolean {
  if (context.club === null) {
    return false;
  }
  return context.availableTeams.some((team) => team.id === teamId);
}

export async function removeObsoleteOfflineGameDay(
  store: GameDaySnapshotStore,
  userId: string,
  context: CurrentClubContext,
): Promise<void> {
  const pointer = await readOfflineContextPointer(store, userId);
  if (pointer === null || contextPermitsTeam(context, pointer.teamId)) {
    return;
  }
  await clearStoredOfflineGameDay(store, userId);
}

export function isOfflineAuthorizationFailure(error: unknown): boolean {
  if (!(error instanceof ApplicationError)) {
    return false;
  }
  return (
    error.code === "FORBIDDEN" ||
    error.code === "UNAUTHENTICATED" ||
    error.code === "NOT_FOUND"
  );
}
