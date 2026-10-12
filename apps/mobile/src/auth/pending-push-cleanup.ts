const pendingPushCleanupKey = "stable-pending-push-cleanup-v1";
let pendingMutationQueue: Promise<void> = Promise.resolve();

export type PendingPushCleanupTransaction = {
  readUsers: () => Promise<string[]>;
  mark: (userId: string) => Promise<void>;
  clear: (userId?: string) => Promise<void>;
};

export function withPendingPushCleanupTransaction<T>(
  store: PendingPushCleanupStore,
  operation: (transaction: PendingPushCleanupTransaction) => Promise<T>,
): Promise<T> {
  const run = () => operation(createTransaction(store));
  const result = pendingMutationQueue.then(run, run);
  pendingMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export type PendingPushCleanupStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

async function readPendingUsers(
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

export async function markPendingPushCleanup(
  store: PendingPushCleanupStore,
  userId: string,
): Promise<void> {
  if (userId.length === 0) throw new Error("A user id is required.");
  await withPendingPushCleanupTransaction(store, ({ mark }) => mark(userId));
}

async function markPendingUser(
  store: PendingPushCleanupStore,
  userId: string,
): Promise<void> {
  const pending = await readPendingUsers(store);
  if (!pending.includes(userId)) {
    pending.push(userId);
    await store.setItem(pendingPushCleanupKey, JSON.stringify(pending));
  }
}

async function clearPendingUser(
  store: PendingPushCleanupStore,
  userId?: string,
): Promise<void> {
  if (userId === undefined) {
    await store.removeItem(pendingPushCleanupKey);
    return;
  }
  const remaining = (await readPendingUsers(store)).filter(
    (pendingUserId) => pendingUserId !== userId,
  );
  if (remaining.length === 0) {
    await store.removeItem(pendingPushCleanupKey);
  } else {
    await store.setItem(pendingPushCleanupKey, JSON.stringify(remaining));
  }
}

function createTransaction(store: PendingPushCleanupStore) {
  return {
    readUsers: () => readPendingUsers(store),
    mark: (userId: string) => markPendingUser(store, userId),
    clear: (userId?: string) => clearPendingUser(store, userId),
  };
}

/*
 * All reads that decide session admission and all marker changes share this
 * queue. Callers performing endpoint revocation also hold it for the complete
 * mark -> revoke -> clear/retain sequence, preventing admission from observing
 * a stale marker set while a revocation is unresolved.
 */
export async function clearPendingPushCleanup(
  store: PendingPushCleanupStore,
  userId?: string,
): Promise<void> {
  await withPendingPushCleanupTransaction(store, async ({ clear }) => {
    await clear(userId);
  });
}

export async function readPendingPushCleanupUsers(
  store: PendingPushCleanupStore,
): Promise<string[]> {
  return withPendingPushCleanupTransaction(store, ({ readUsers }) =>
    readUsers(),
  );
}

export async function readPendingPushCleanup(
  store: PendingPushCleanupStore,
): Promise<string | null> {
  return (await readPendingPushCleanupUsers(store))[0] ?? null;
}

export async function tryRemovePushRegistrationOrRetainFence(input: {
  readonly store: PendingPushCleanupStore;
  readonly userId: string;
  readonly removeRegistration: (userId: string) => Promise<void | boolean>;
}): Promise<boolean> {
  return withPendingPushCleanupTransaction(
    input.store,
    async ({ mark, clear }) => {
      await mark(input.userId);
      try {
        const removed = await input.removeRegistration(input.userId);
        if (removed !== false) {
          await clear(input.userId);
          return true;
        }
      } catch {
        // Keep this account fenced when remote revocation cannot be confirmed.
      }
      return false;
    },
  );
}

export async function enforcePendingPushCleanup(input: {
  readonly store: PendingPushCleanupStore;
  readonly nextUserId: string;
  readonly removeRegistration: (userId: string) => Promise<void | boolean>;
  readonly rejectOtherAccount: () => Promise<void>;
}): Promise<void> {
  return withPendingPushCleanupTransaction(
    input.store,
    async ({ readUsers, mark, clear }) => {
      const pendingUserIds = await readUsers();
      if (pendingUserIds.length === 0) return;
      if (!pendingUserIds.includes(input.nextUserId)) {
        await mark(input.nextUserId);
        try {
          const removed = await input.removeRegistration(input.nextUserId);
          if (removed !== false) await clear(input.nextUserId);
        } catch {
          // Retain the identity fence when cleanup cannot be confirmed.
        }
        await input.rejectOtherAccount();
        throw new Error("A previous account push cleanup is still required.");
      }

      const removed = await input.removeRegistration(input.nextUserId);
      if (removed === false) {
        // A single pending account may recover its own Expo token and retry.
        // With multiple accounts, no identity can enter until all are resolved.
        if (pendingUserIds.length === 1) return;
        await input.rejectOtherAccount();
        throw new Error("A previous account push cleanup is still required.");
      }
      await clear(input.nextUserId);
      if ((await readUsers()).length > 0) {
        await input.rejectOtherAccount();
        throw new Error("A previous account push cleanup is still required.");
      }
    },
  );
}
