import {
  cleanPendingCallbackPushRegistration,
  clearSessionAfterCallbackTransitionFailure,
  removePreviousPushAfterSuccessfulAccountSwitch,
} from "./callback-push-cleanup";
import {
  markPendingPushCleanup,
  readPendingPushCleanupUsers,
  type PendingPushCleanupStore,
} from "./pending-push-cleanup";

const previous = {
  userId: "19191919-1919-4919-8919-191919191919",
  accessToken: "old-access-token",
  refreshToken: "old-refresh-token",
};
describe("callback push cleanup", () => {
  it("cleans a pending callback account without moving it behind other accounts", async () => {
    const values = new Map<string, string>();
    const store: PendingPushCleanupStore = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    };
    await markPendingPushCleanup(store, "other-user");
    await markPendingPushCleanup(store, "current-user");
    const removedUsers: string[] = [];

    const cleaned = await cleanPendingCallbackPushRegistration({
      store,
      userId: "current-user",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      removeRegistration: async (userId) => {
        removedUsers.push(userId);
        return true;
      },
    });

    expect(cleaned).toBe(true);
    expect(removedUsers).toEqual(["current-user"]);
    expect(await readPendingPushCleanupUsers(store)).toEqual(["other-user"]);
  });

  it("clears persisted auth when local sign-out resolves with an error", async () => {
    let clearCalls = 0;

    await clearSessionAfterCallbackTransitionFailure(
      async () => ({ error: new Error("sign-out failed") }),
      async () => {
        clearCalls += 1;
      },
    );

    expect(clearCalls).toBe(1);
  });

  it("does not clear persisted auth when local sign-out succeeds", async () => {
    let clearCalls = 0;

    await clearSessionAfterCallbackTransitionFailure(
      async () => ({ error: null }),
      async () => {
        clearCalls += 1;
      },
    );

    expect(clearCalls).toBe(0);
  });

  it("clears persisted auth when local sign-out throws", async () => {
    let clearCalls = 0;

    await clearSessionAfterCallbackTransitionFailure(
      async () => {
        throw new Error("sign-out threw");
      },
      async () => {
        clearCalls += 1;
      },
    );

    expect(clearCalls).toBe(1);
  });

  it("removes the prior endpoint only after a successful account switch", async () => {
    const calls: unknown[][] = [];
    const removeRegistration = async (...args: string[]) => {
      calls.push(args);
    };
    await removePreviousPushAfterSuccessfulAccountSwitch(
      previous,
      "29292929-2929-4929-8929-292929292929",
      removeRegistration,
    );
    expect(calls).toEqual([
      [previous.userId, previous.accessToken, previous.refreshToken],
    ]);
  });

  it("does not remove an endpoint for an invalid callback", async () => {
    const calls: unknown[][] = [];
    const removeRegistration = async (...args: string[]) => {
      calls.push(args);
    };
    let finishSuccessfulAccountSwitch:
      ((nextUserId: string) => Promise<boolean>) | undefined;
    let failure: unknown;
    try {
      finishSuccessfulAccountSwitch = async (nextUserId) =>
        removePreviousPushAfterSuccessfulAccountSwitch(
          previous,
          nextUserId,
          removeRegistration,
        );
      throw new Error("callback exchange failed");
    } catch (error: unknown) {
      failure = error;
    }
    expect(failure).toEqual(new Error("callback exchange failed"));
    expect(finishSuccessfulAccountSwitch).toBeDefined();
    expect(calls.length).toBe(0);
  });

  it("keeps the endpoint for a successful callback to the same account", async () => {
    let calls = 0;
    await removePreviousPushAfterSuccessfulAccountSwitch(
      previous,
      previous.userId,
      async () => {
        calls += 1;
      },
    );
    expect(calls).toBe(0);
  });

  it("does nothing when there is no previous account session", async () => {
    let calls = 0;
    await removePreviousPushAfterSuccessfulAccountSwitch(
      null,
      "next-user",
      async () => {
        calls += 1;
      },
    );
    expect(calls).toBe(0);
  });

  it("propagates unresolved token state instead of claiming cleanup succeeded", async () => {
    const removed = await removePreviousPushAfterSuccessfulAccountSwitch(
      previous,
      "29292929-2929-4929-8929-292929292929",
      async () => false,
    );
    expect(removed).toBe(false);
  });
});
