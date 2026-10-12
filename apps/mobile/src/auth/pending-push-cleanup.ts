const pendingPushCleanupKey = "stable-pending-push-cleanup-v1";

export type PendingPushCleanupStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export async function readPendingPushCleanup(
  store: PendingPushCleanupStore,
): Promise<string | null> {
  const userId = await store.getItem(pendingPushCleanupKey);
  if (userId === null || userId.length === 0) return null;
  return userId;
}

export async function markPendingPushCleanup(
  store: PendingPushCleanupStore,
  userId: string,
): Promise<void> {
  if (userId.length === 0) throw new Error("A user id is required.");
  await store.setItem(pendingPushCleanupKey, userId);
}

export async function clearPendingPushCleanup(
  store: PendingPushCleanupStore,
): Promise<void> {
  await store.removeItem(pendingPushCleanupKey);
}

export async function enforcePendingPushCleanup(input: {
  readonly store: PendingPushCleanupStore;
  readonly nextUserId: string;
  readonly removeRegistration: (userId: string) => Promise<void | boolean>;
  readonly rejectOtherAccount: () => Promise<void>;
}): Promise<void> {
  const pendingUserId = await readPendingPushCleanup(input.store);
  if (pendingUserId === null) return;
  if (pendingUserId !== input.nextUserId) {
    await input.rejectOtherAccount();
    throw new Error("A previous account push cleanup is still required.");
  }

  const removed = await input.removeRegistration(pendingUserId);
  // A returning prior account may be admitted so the device lifecycle can
  // restore its current Expo token. Keep the marker until the endpoint is
  // subsequently revoked; never interpret missing local token state as proof
  // that the server endpoint was removed.
  if (removed === false) return;
  await clearPendingPushCleanup(input.store);
}
