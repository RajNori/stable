import { cleanupPushAfterSuccessfulCallback } from "./callback-push-cleanup";

const previous = {
  userId: "19191919-1919-4919-8919-191919191919",
  accessToken: "old-access-token",
  refreshToken: "old-refresh-token",
};
const sameUser = {
  state: "authenticated" as const,
  principal: { userId: previous.userId, displayName: "Member" },
};
const otherUser = {
  state: "authenticated" as const,
  principal: {
    userId: "28282828-2828-4828-8828-282828282828",
    displayName: "Other member",
  },
};

describe("callback push cleanup", () => {
  it("does not remove registration when callback returns to the same account", async () => {
    const calls: unknown[][] = [];
    const removeRegistration = async (...args: string[]) => {
      calls.push(args);
    };
    await cleanupPushAfterSuccessfulCallback(
      previous,
      removeRegistration,
    )(sameUser);
    expect(calls.length).toBe(0);
  });

  it("removes the previous account registration only after a successful account switch", async () => {
    const calls: unknown[][] = [];
    const removeRegistration = async (...args: string[]) => {
      calls.push(args);
    };
    await cleanupPushAfterSuccessfulCallback(
      previous,
      removeRegistration,
    )(otherUser);
    expect(calls).toEqual([
      [previous.userId, previous.accessToken, previous.refreshToken],
    ]);
  });

  it("does not remove registration when callback does not authenticate", async () => {
    const calls: unknown[][] = [];
    const removeRegistration = async (...args: string[]) => {
      calls.push(args);
    };
    await cleanupPushAfterSuccessfulCallback(
      previous,
      removeRegistration,
    )({ state: "unauthenticated" });
    expect(calls.length).toBe(0);
  });
});
