import {
  clearSessionAfterCallbackTransitionFailure,
  removePreviousPushBeforeCallback,
} from "./callback-push-cleanup";

const previous = {
  userId: "19191919-1919-4919-8919-191919191919",
  accessToken: "old-access-token",
  refreshToken: "old-refresh-token",
};
describe("callback push cleanup", () => {
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

  it("removes the previous endpoint before callback exchange", async () => {
    const calls: unknown[][] = [];
    const removeRegistration = async (...args: string[]) => {
      calls.push(args);
    };
    await removePreviousPushBeforeCallback(previous, removeRegistration);
    expect(calls).toEqual([
      [previous.userId, previous.accessToken, previous.refreshToken],
    ]);
  });

  it("does not exchange a callback when prior endpoint removal fails", async () => {
    const calls: unknown[][] = [];
    const removalFailure = new Error("endpoint cleanup failed");
    const removeRegistration = async (...args: string[]) => {
      calls.push(args);
      throw removalFailure;
    };
    let failure: unknown;
    try {
      await removePreviousPushBeforeCallback(previous, removeRegistration);
    } catch (error: unknown) {
      failure = error;
    }
    expect(failure).toBe(removalFailure);
    expect(calls.length).toBe(1);
  });

  it("does nothing when there is no previous account session", async () => {
    let calls = 0;
    await removePreviousPushBeforeCallback(null, async () => {
      calls += 1;
    });
    expect(calls).toBe(0);
  });
});
