import {
  clearPendingPushCleanup,
  enforcePendingPushCleanup,
  markPendingPushCleanup,
  readPendingPushCleanup,
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
    expect([...values.values()]).toEqual(["prior-user"]);

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
});
