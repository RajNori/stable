import {
  clearPendingPushCleanup,
  enforcePendingPushCleanup,
  markPendingPushCleanup,
  readPendingPushCleanup,
  readPendingPushCleanupUsers,
  resumePushRegistration,
  suspendPushRegistration,
  tryRemovePushRegistrationOrRetainFence,
  withPushRegistrationAdmission,
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

  it("serializes concurrent marker read-modify-write operations", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };

    await Promise.all([
      markPendingPushCleanup(store, "first-user"),
      markPendingPushCleanup(store, "second-user"),
    ]);
    expect(await readPendingPushCleanupUsers(store)).toEqual([
      "first-user",
      "second-user",
    ]);

    await Promise.all([
      clearPendingPushCleanup(store, "first-user"),
      markPendingPushCleanup(store, "third-user"),
    ]);
    expect(await readPendingPushCleanupUsers(store)).toEqual([
      "second-user",
      "third-user",
    ]);
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

  it("fences a new revocation before it starts and queues admission behind it", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "first-user");

    let releaseFirstRemoval: (() => void) | undefined;
    let firstRemovalStarted: (() => void) | undefined;
    const removalStarted = new Promise<void>((resolve) => {
      firstRemovalStarted = resolve;
    });
    const firstAdmission = enforcePendingPushCleanup({
      store,
      nextUserId: "first-user",
      removeRegistration: async () => {
        firstRemovalStarted?.();
        await new Promise<void>((resolve) => {
          releaseFirstRemoval = resolve;
        });
        return false;
      },
      rejectOtherAccount: async () => undefined,
    });
    await removalStarted;

    let secondRevocationSawFence = false;
    const secondRevocation = tryRemovePushRegistrationOrRetainFence({
      store,
      userId: "second-user",
      removeRegistration: async () => {
        secondRevocationSawFence =
          values
            .get("stable-pending-push-cleanup-v1")
            ?.includes("second-user") ?? false;
        return false;
      },
    });
    let secondAdmissionRejected = false;
    const secondAdmission = enforcePendingPushCleanup({
      store,
      nextUserId: "second-user",
      removeRegistration: async () => false,
      rejectOtherAccount: async () => {
        secondAdmissionRejected = true;
      },
    });

    releaseFirstRemoval?.();
    await firstAdmission;
    expect(await secondRevocation).toBe(false);
    await expect(secondAdmission).rejects.toThrow(
      "A previous account push cleanup is still required.",
    );
    expect(secondRevocationSawFence).toBe(true);
    expect(secondAdmissionRejected).toBe(true);
    expect(await readPendingPushCleanupUsers(store)).toEqual([
      "first-user",
      "second-user",
    ]);
  });

  it("serializes an in-flight token refresh with sign-out and skips late registration", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    const userId = "push-refresh-user";
    resumePushRegistration(userId);

    let releaseToken: (() => void) | undefined;
    let tokenLookupStarted: (() => void) | undefined;
    const tokenStarted = new Promise<void>((resolve) => {
      tokenLookupStarted = resolve;
    });
    let registrationCalls = 0;
    const registration = withPushRegistrationAdmission({
      store,
      userId,
      operation: async (canContinue) => {
        tokenLookupStarted?.();
        await new Promise<void>((resolve) => {
          releaseToken = resolve;
        });
        if (!canContinue()) return "cleanup-pending" as const;
        registrationCalls += 1;
        return "registered" as const;
      },
      shouldClearFence: (status) => status !== "cleanup-pending",
    });
    await tokenStarted;

    suspendPushRegistration(userId);
    const signOutCleanup = tryRemovePushRegistrationOrRetainFence({
      store,
      userId,
      removeRegistration: async () => true,
    });
    releaseToken?.();

    expect(await registration).toEqual({
      admitted: true,
      value: "cleanup-pending",
    });
    expect(await signOutCleanup).toBe(true);
    expect(registrationCalls).toBe(0);
    expect(await readPendingPushCleanupUsers(store)).toEqual([]);
    resumePushRegistration(userId);
  });

  it("revokes an endpoint after registration that was already in flight before sign-out", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    const userId = "completed-refresh-user";
    resumePushRegistration(userId);
    let finishRegistration: (() => void) | undefined;
    const endpointRegistered = new Promise<void>((resolve) => {
      finishRegistration = resolve;
    });
    let endpointActive = false;
    const registration = withPushRegistrationAdmission({
      store,
      userId,
      operation: async () => {
        endpointActive = true;
        finishRegistration?.();
        return "registered";
      },
    });
    await endpointRegistered;

    suspendPushRegistration(userId);
    const signOutCleanup = tryRemovePushRegistrationOrRetainFence({
      store,
      userId,
      removeRegistration: async () => {
        endpointActive = false;
        return true;
      },
    });
    expect(await registration).toEqual({
      admitted: true,
      value: "registered",
    });
    expect(await signOutCleanup).toBe(true);
    expect(endpointActive).toBe(false);
    expect(await readPendingPushCleanupUsers(store)).toEqual([]);
    resumePushRegistration(userId);
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
