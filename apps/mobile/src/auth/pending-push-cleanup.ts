const pendingPushCleanupKey = "stable-pending-push-cleanup-v1";

export type PendingPushCleanupStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export async function readPendingPushCleanupUsers(
  store: PendingPushCleanupStore,
): Promise<string[]> {
  const value = await store.getItem(pendingPushCleanupKey);
  if (value === null || value.length === 0) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    ) {
      return [...new Set(parsed.filter((item) => item.length > 0))];
    }
  } catch {
    // A legacy marker is a raw user id. Treat any malformed nonempty marker as
    // one opaque id so corrupt state fails closed rather than clearing itself.
  }
  return [value];
}

export async function readPendingPushCleanup(
  store: PendingPushCleanupStore,
): Promise<string | null> {
  return (await readPendingPushCleanupUsers(store))[0] ?? null;
}

export async function markPendingPushCleanup(
  store: PendingPushCleanupStore,
  userId: string,
): Promise<void> {
  if (userId.length === 0) throw new Error("A user id is required.");
  const pending = await readPendingPushCleanupUsers(store);
  if (!pending.includes(userId)) {
    pending.push(userId);
    await store.setItem(pendingPushCleanupKey, JSON.stringify(pending));
  }
}

export async function clearPendingPushCleanup(
  store: PendingPushCleanupStore,
  userId?: string,
): Promise<void> {
  if (userId === undefined) {
    await store.removeItem(pendingPushCleanupKey);
    return;
  }
  const remaining = (await readPendingPushCleanupUsers(store)).filter(
    (pendingUserId) => pendingUserId !== userId,
  );
  if (remaining.length === 0) {
    await store.removeItem(pendingPushCleanupKey);
  } else {
    await store.setItem(pendingPushCleanupKey, JSON.stringify(remaining));
  }
}

export async function tryRemovePushRegistrationOrRetainFence(input: {
  readonly store: PendingPushCleanupStore;
  readonly userId: string;
  readonly removeRegistration: (userId: string) => Promise<void | boolean>;
}): Promise<boolean> {
  try {
    const removed = await input.removeRegistration(input.userId);
    if (removed !== false) {
      await clearPendingPushCleanup(input.store, input.userId);
      return true;
    }
  } catch {
    // Keep this account fenced when remote revocation cannot be confirmed.
  }
  await markPendingPushCleanup(input.store, input.userId);
  return false;
}

export async function enforcePendingPushCleanup(input: {
  readonly store: PendingPushCleanupStore;
  readonly nextUserId: string;
  readonly removeRegistration: (userId: string) => Promise<void | boolean>;
  readonly rejectOtherAccount: () => Promise<void>;
}): Promise<void> {
  const pendingUserIds = await readPendingPushCleanupUsers(input.store);
  const pendingUserId = pendingUserIds[0];
  if (pendingUserId === undefined) return;
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
  await clearPendingPushCleanup(input.store, pendingUserId);
  if ((await readPendingPushCleanupUsers(input.store)).length > 0) {
    await input.rejectOtherAccount();
    throw new Error("A previous account push cleanup is still required.");
  }
}
