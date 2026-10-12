import {
  clearPendingPushCleanup,
  enforcePendingPushCleanup,
  markPendingPushCleanup,
  readPendingPushCleanup,
  readPendingPushCleanupUsers,
  tryRemovePushRegistrationOrRetainFence,
  type PendingPushCleanupStore,
} from "./pending-push-cleanup";

describe("pending push cleanup fence", () => {
  it("persists only the prior account id and clears it after cleanup", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };

    await markPendingPushCleanup(store, "prior-user");
    expect(await readPendingPushCleanup(store)).toBe("prior-user");
    expect(await readPendingPushCleanupUsers(store)).toEqual(["prior-user"]);

    await clearPendingPushCleanup(store);
    expect(await readPendingPushCleanup(store)).toBeNull();
  });

  it("does not mark an empty account id", async () => {
    const store: PendingPushCleanupStore = {
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };

    await expect(markPendingPushCleanup(store, "")).rejects.toThrow(
      "A user id is required.",
    );
  });

  it("cleans the previous endpoint before accepting that same account", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "prior-user");
    const removedUsers: string[] = [];
    let rejectCalls = 0;

    await enforcePendingPushCleanup({
      store,
      nextUserId: "prior-user",
      removeRegistration: async (userId) => void removedUsers.push(userId),
      rejectOtherAccount: async () => void (rejectCalls += 1),
    });

    expect(removedUsers).toEqual(["prior-user"]);
    expect(rejectCalls).toBe(0);
    expect(await readPendingPushCleanup(store)).toBeNull();
  });

  it("rejects another account and retains the pending fence on cleanup failure", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "prior-user");
    let rejectCalls = 0;

    await expect(
      enforcePendingPushCleanup({
        store,
        nextUserId: "next-user",
        removeRegistration: async () => undefined,
        rejectOtherAccount: async () => void (rejectCalls += 1),
      }),
    ).rejects.toThrow("A previous account push cleanup is still required.");

    expect(rejectCalls).toBe(1);
    expect(await readPendingPushCleanup(store)).toBe("prior-user");
  });

  it("keeps the fence when local token state cannot prove endpoint revocation", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "prior-user");

    await enforcePendingPushCleanup({
      store,
      nextUserId: "prior-user",
      removeRegistration: async () => false,
      rejectOtherAccount: async () => {
        throw new Error("same account must remain recoverable");
      },
    });

    expect(await readPendingPushCleanup(store)).toBe("prior-user");
  });

  it("retains multiple unresolved accounts and resolves them in order", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "first-user");
    await markPendingPushCleanup(store, "second-user");
    await markPendingPushCleanup(store, "second-user");

    expect(await readPendingPushCleanupUsers(store)).toEqual([
      "first-user",
      "second-user",
    ]);
    let rejectCalls = 0;
    await expect(
      enforcePendingPushCleanup({
        store,
        nextUserId: "first-user",
        removeRegistration: async () => true,
        rejectOtherAccount: async () => void (rejectCalls += 1),
      }),
    ).rejects.toThrow("A previous account push cleanup is still required.");

    expect(rejectCalls).toBe(1);
    expect(await readPendingPushCleanupUsers(store)).toEqual(["second-user"]);
  });

  it("does not admit one account while another account endpoint remains unresolved", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "first-user");
    await markPendingPushCleanup(store, "second-user");
    let rejectCalls = 0;

    await expect(
      enforcePendingPushCleanup({
        store,
        nextUserId: "first-user",
        removeRegistration: async () => false,
        rejectOtherAccount: async () => void (rejectCalls += 1),
      }),
    ).rejects.toThrow("A previous account push cleanup is still required.");

    expect(rejectCalls).toBe(1);
    expect(await readPendingPushCleanupUsers(store)).toEqual([
      "first-user",
      "second-user",
    ]);
  });

  it("lets any pending account clean its own endpoint but denies entry until all are clear", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "first-user");
    await markPendingPushCleanup(store, "second-user");
    let rejectCalls = 0;

    await expect(
      enforcePendingPushCleanup({
        store,
        nextUserId: "second-user",
        removeRegistration: async () => true,
        rejectOtherAccount: async () => void (rejectCalls += 1),
      }),
    ).rejects.toThrow("A previous account push cleanup is still required.");

    expect(rejectCalls).toBe(1);
    expect(await readPendingPushCleanupUsers(store)).toEqual(["first-user"]);
  });

  it("reads a legacy single-user marker so it can be upgraded safely", async () => {
    const store: PendingPushCleanupStore = {
      getItem: async () => "legacy-user",
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    expect(await readPendingPushCleanupUsers(store)).toEqual(["legacy-user"]);
  });

  it("records a mismatched restored account when endpoint cleanup is unresolved", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "previous-user");

    const removed = await tryRemovePushRegistrationOrRetainFence({
      store,
      userId: "mismatched-restored-user",
      removeRegistration: async () => false,
    });

    expect(removed).toBe(false);
    expect(await readPendingPushCleanupUsers(store)).toEqual([
      "previous-user",
      "mismatched-restored-user",
    ]);
  });
});
