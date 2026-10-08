import { ApplicationError, AUTH_ERROR_MESSAGES } from "@stable/contracts";
import type { AuthSessionSnapshot } from "@stable/contracts";
import { QueryClient } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import { memoryGameDaySnapshotStore } from "../game-day-snapshot";
import {
  clearStoredOfflineGameDay,
  readOfflineContextPointer,
  saveOfflineContextPointer,
} from "../offline-context";
import { MobileAuthGate } from "./mobile-auth-gate";

declare const jest: {
  mock: (moduleName: string, factory: () => unknown) => void;
  fn: <T extends (...args: never[]) => unknown>(
    implementation: T,
  ) => T & { mock: { calls: unknown[][] } };
};

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const authenticated = {
  state: "authenticated",
  principal: { userId },
} as const satisfies AuthSessionSnapshot;
const secondUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const secondAuthenticated = {
  state: "authenticated",
  principal: { userId: secondUserId },
} as const satisfies AuthSessionSnapshot;

describe("mobile auth gate", () => {
  it("shows the auth entry until a session is restored", async () => {
    let renders = 0;
    await render(
      <MobileAuthGate
        restore={async () => ({ state: "unauthenticated" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions()}
        authenticated={() => {
          renders += 1;
          return <Text>Club home</Text>;
        }}
      />,
    );

    expect(
      await screen.findByText("Know what's next. Show up ready."),
    ).toBeTruthy();
    expect(renders).toBe(0);
  }, 15_000);

  it("opens the app after restore and signs out locally", async () => {
    const scopes: string[] = [];
    await render(
      <MobileAuthGate
        restore={async () => authenticated}
        signOut={async () => {
          scopes.push("local");
          return { state: "unauthenticated" };
        }}
        actions={idleActions()}
        authenticated={() => <Text>Club home</Text>}
      />,
    );

    expect(await screen.findByText("Club home")).toBeTruthy();
    expect(screen.queryByText("Know what's next. Show up ready.")).toBeNull();
    await userEvent.press(screen.getByLabelText("Sign out"));
    expect(
      await screen.findByText("Know what's next. Show up ready."),
    ).toBeTruthy();
    expect(scopes).toEqual(["local"]);
  });

  it("clears private cached data on sign-out and account switch", async () => {
    let receive: ((url: string) => void) | undefined;
    const queryClient = new QueryClient();
    const clearPrivateCache = jest.fn(() => {
      void queryClient.cancelQueries();
      queryClient.clear();
    });
    await render(
      <MobileAuthGate
        restore={async () => authenticated}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          async completeCallback() {
            return secondAuthenticated;
          },
        })}
        clearPrivateCache={clearPrivateCache}
        linking={{
          async getInitialUrl() {
            return null;
          },
          subscribe(listener) {
            receive = listener;
            return () => {
              receive = undefined;
            };
          },
        }}
        authenticated={(id) => <Text>Signed in as {id}</Text>}
      />,
    );

    expect(await screen.findByText(`Signed in as ${userId}`)).toBeTruthy();
    queryClient.setQueryData(["current-club-context"], {
      displayName: "first account private club",
    });
    queryClient.setQueryData(["team-roster", "first-team"], ["private roster"]);
    receive?.("stable://auth/callback?code=account-switch");
    expect(
      await screen.findByText(`Signed in as ${secondUserId}`),
    ).toBeTruthy();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);

    queryClient.setQueryData(["current-club-context"], {
      displayName: "second account private club",
    });
    await userEvent.press(screen.getByLabelText("Sign out"));
    expect(
      await screen.findByText("Know what's next. Show up ready."),
    ).toBeTruthy();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(clearPrivateCache.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("clears only the prior user's offline data on callback account switch", async () => {
    let receive: ((url: string) => void) | undefined;
    const store = memoryGameDaySnapshotStore();
    const previousTeamId = "previous-team";
    const nextTeamId = "next-team";
    await store.setItem(
      `stable.game-day.v1.${userId}.${previousTeamId}`,
      "previous-user snapshot",
    );
    await store.setItem(
      `stable.game-day.v1.${userId}`,
      JSON.stringify({ teams: [previousTeamId] }),
    );
    await store.setItem(
      `stable.game-day.v1.${secondUserId}.${nextTeamId}`,
      "next-user snapshot",
    );
    await store.setItem(
      `stable.game-day.v1.${secondUserId}`,
      JSON.stringify({ teams: [nextTeamId] }),
    );
    await saveOfflineContextPointer(store, {
      version: 1,
      userId,
      teamId: previousTeamId,
    });
    await saveOfflineContextPointer(store, {
      version: 1,
      userId: secondUserId,
      teamId: nextTeamId,
    });

    const clearPrivateCache = jest.fn(async (previousUserId: string | null) => {
      if (previousUserId !== null) {
        await clearStoredOfflineGameDay(store, previousUserId);
      }
    });
    await render(
      <MobileAuthGate
        restore={async () => authenticated}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          async completeCallback() {
            return secondAuthenticated;
          },
        })}
        clearPrivateCache={clearPrivateCache}
        linking={{
          async getInitialUrl() {
            return null;
          },
          subscribe(listener) {
            receive = listener;
            return () => {
              receive = undefined;
            };
          },
        }}
        authenticated={(id) => <Text>Signed in as {id}</Text>}
      />,
    );

    expect(await screen.findByText(`Signed in as ${userId}`)).toBeTruthy();
    receive?.("stable://auth/callback?code=account-switch");
    expect(
      await screen.findByText(`Signed in as ${secondUserId}`),
    ).toBeTruthy();

    expect(
      clearPrivateCache.mock.calls.some(([previousUserId]) =>
        Object.is(previousUserId, userId),
      ),
    ).toBe(true);
    expect(
      await store.getItem(`stable.game-day.v1.${userId}.${previousTeamId}`),
    ).toBeNull();
    expect(await store.getItem(`stable.game-day.v1.${userId}`)).toBeNull();
    expect(
      await store.getItem(`stable.game-day.v1.${secondUserId}.${nextTeamId}`),
    ).toBe("next-user snapshot");
    expect(await store.getItem(`stable.game-day.v1.${secondUserId}`)).toBe(
      JSON.stringify({ teams: [nextTeamId] }),
    );
    expect(await readOfflineContextPointer(store, userId)).toBeNull();
    expect(await readOfflineContextPointer(store, secondUserId)).toEqual({
      version: 1,
      userId: secondUserId,
      teamId: nextTeamId,
    });
  });

  it("does not activate the next account when private cache cleanup fails", async () => {
    let receive: ((url: string) => void) | undefined;
    await render(
      <MobileAuthGate
        restore={async () => authenticated}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          async completeCallback() {
            return secondAuthenticated;
          },
        })}
        clearPrivateCache={async (previousUserId) => {
          if (previousUserId === userId) {
            throw new Error("SecureStore cleanup failed");
          }
        }}
        linking={{
          async getInitialUrl() {
            return null;
          },
          subscribe(listener) {
            receive = listener;
            return () => {
              receive = undefined;
            };
          },
        }}
        authenticated={(id) => <Text>Signed in as {id}</Text>}
      />,
    );

    expect(await screen.findByText(`Signed in as ${userId}`)).toBeTruthy();
    receive?.("stable://auth/callback?code=account-switch");
    expect(await screen.findByText(AUTH_ERROR_MESSAGES.INTERNAL)).toBeTruthy();
    expect(screen.queryByText(`Signed in as ${secondUserId}`)).toBeNull();
  });

  it("shows expired and recovery without pretending the adult signed out", async () => {
    const { rerender } = await render(
      <MobileAuthGate
        restore={async () => ({ state: "expired" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions()}
        authenticated={() => <Text>Club home</Text>}
      />,
    );
    expect(
      await screen.findByText("Your session has ended. Sign in again."),
    ).toBeTruthy();

    await rerender(
      <MobileAuthGate
        restore={async () => ({
          state: "recovery",
          errorCode: "UPSTREAM_UNAVAILABLE",
          message: AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
        })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions()}
        authenticated={() => <Text>Club home</Text>}
      />,
    );
    expect(
      await screen.findByText(AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE),
    ).toBeTruthy();
    expect(screen.queryByText("Club home")).toBeNull();
  });

  it("keeps a failed callback out of the screen and does not echo the url", async () => {
    const secretUrl =
      "stable://auth/callback?code=abcdefgh&access_token=secret-token";
    await render(
      <MobileAuthGate
        restore={async () => ({ state: "unauthenticated" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          async completeCallback() {
            throw new ApplicationError(
              "VALIDATION_FAILED",
              AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
            );
          },
        })}
        linking={{
          async getInitialUrl() {
            return secretUrl;
          },
          subscribe() {
            return () => undefined;
          },
        }}
        authenticated={() => <Text>Club home</Text>}
      />,
    );

    expect(
      await screen.findByText(AUTH_ERROR_MESSAGES.VALIDATION_FAILED),
    ).toBeTruthy();
    await waitFor(() => {
      expect(JSON.stringify(screen.toJSON()).includes("secret-token")).toBe(
        false,
      );
    });
  });

  it("uses a successful initial auth callback to open the app", async () => {
    const complete = jest.fn(async () => authenticated);
    await render(
      <MobileAuthGate
        restore={async () => ({ state: "unauthenticated" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({ completeCallback: complete })}
        linking={{
          async getInitialUrl() {
            return "stable://auth/callback?code=local-code";
          },
          subscribe() {
            return () => undefined;
          },
        }}
        authenticated={(id) => <Text>Signed in as {id}</Text>}
      />,
    );

    expect(await screen.findByText(`Signed in as ${userId}`)).toBeTruthy();
    expect(complete.mock.calls[0]).toEqual([
      "stable://auth/callback?code=local-code",
    ]);
  });

  it("keeps a callback session when an older restore resolves afterward", async () => {
    let resolveRestore: ((snapshot: AuthSessionSnapshot) => void) | undefined;
    const restore = new Promise<AuthSessionSnapshot>((resolve) => {
      resolveRestore = resolve;
    });
    await render(
      <MobileAuthGate
        restore={() => restore}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          async completeCallback() {
            return secondAuthenticated;
          },
        })}
        linking={{
          async getInitialUrl() {
            return "stable://auth/callback?code=account-b";
          },
          subscribe() {
            return () => undefined;
          },
        }}
        authenticated={(id) => <Text>Signed in as {id}</Text>}
      />,
    );

    expect(
      await screen.findByText(`Signed in as ${secondUserId}`),
    ).toBeTruthy();
    await act(async () => {
      resolveRestore?.(authenticated);
      await restore;
      await Promise.resolve();
    });

    expect(screen.getByText(`Signed in as ${secondUserId}`)).toBeTruthy();
    expect(screen.queryByText(`Signed in as ${userId}`)).toBeNull();
  });

  it("hides the previous account while an account-switch callback is pending", async () => {
    let receive: ((url: string) => void) | undefined;
    let resolveCallback: ((snapshot: AuthSessionSnapshot) => void) | undefined;
    const callback = new Promise<AuthSessionSnapshot>((resolve) => {
      resolveCallback = resolve;
    });
    await render(
      <MobileAuthGate
        restore={async () => authenticated}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({ completeCallback: () => callback })}
        linking={{
          async getInitialUrl() {
            return null;
          },
          subscribe(listener) {
            receive = listener;
            return () => {
              receive = undefined;
            };
          },
        }}
        authenticated={(id) => <Text>Signed in as {id}</Text>}
      />,
    );

    expect(await screen.findByText(`Signed in as ${userId}`)).toBeTruthy();
    receive?.("stable://auth/callback?code=account-b");
    expect(await screen.findByText("Completing sign-in…")).toBeTruthy();
    expect(screen.queryByText(`Signed in as ${userId}`)).toBeNull();

    await act(async () => {
      resolveCallback?.(secondAuthenticated);
      await callback;
      await Promise.resolve();
    });
    expect(
      await screen.findByText(`Signed in as ${secondUserId}`),
    ).toBeTruthy();
  });

  it("clears stale callback pending state when email OTP completes first", async () => {
    let receive: ((url: string) => void) | undefined;
    let callbackStarted: (() => void) | undefined;
    let resolveCallback: ((snapshot: AuthSessionSnapshot) => void) | undefined;
    const callback = new Promise<AuthSessionSnapshot>((resolve) => {
      resolveCallback = resolve;
    });
    await render(
      <MobileAuthGate
        restore={async () => ({ state: "unauthenticated" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          completeCallback: () => {
            callbackStarted?.();
            return callback;
          },
          async verifyEmail() {
            return secondAuthenticated;
          },
        })}
        linking={{
          async getInitialUrl() {
            return null;
          },
          subscribe(listener) {
            receive = listener;
            return () => {
              receive = undefined;
            };
          },
        }}
        authenticated={(id) => <Text>Signed in as {id}</Text>}
      />,
    );

    expect(
      await screen.findByText("Know what's next. Show up ready."),
    ).toBeTruthy();
    const callbackHasStarted = new Promise<void>((resolve) => {
      callbackStarted = resolve;
    });
    receive?.("stable://auth/callback?code=pending");
    await callbackHasStarted;

    await userEvent.press(screen.getByLabelText("Continue with email"));
    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "adult@example.com",
    );
    await userEvent.press(screen.getByLabelText("Send code"));
    fireEvent.changeText(
      await screen.findByLabelText("6-digit code"),
      "123456",
    );
    await userEvent.press(screen.getByLabelText("Continue"));

    expect(
      await screen.findByText(`Signed in as ${secondUserId}`),
    ).toBeTruthy();
    await act(async () => {
      resolveCallback?.(authenticated);
      await callback;
      await Promise.resolve();
    });
    expect(screen.getByText(`Signed in as ${secondUserId}`)).toBeTruthy();
    expect(screen.queryByText("Completing sign-in…")).toBeNull();
  });

  it("uses safe recovery when both a callback and session restore fail", async () => {
    let receive: ((url: string) => void) | undefined;
    let restoreCount = 0;
    await render(
      <MobileAuthGate
        restore={async () => {
          restoreCount += 1;
          if (restoreCount > 1) {
            throw new Error("private provider details");
          }
          return authenticated;
        }}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          completeCallback: async () => {
            throw new Error("private callback details");
          },
        })}
        linking={{
          async getInitialUrl() {
            return null;
          },
          subscribe(listener) {
            receive = listener;
            return () => {
              receive = undefined;
            };
          },
        }}
        authenticated={(id) => <Text>Signed in as {id}</Text>}
      />,
    );

    expect(await screen.findByText(`Signed in as ${userId}`)).toBeTruthy();
    receive?.("stable://auth/callback?code=private");
    expect(await screen.findByText(AUTH_ERROR_MESSAGES.INTERNAL)).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain("private provider");
    expect(JSON.stringify(screen.toJSON())).not.toContain("private callback");
  });

  it("ignores unrelated links and accepts a later callback once", async () => {
    let receive: ((url: string) => void) | undefined;
    const complete = jest.fn(async () => authenticated);
    await render(
      <MobileAuthGate
        restore={async () => ({ state: "unauthenticated" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({ completeCallback: complete })}
        linking={{
          async getInitialUrl() {
            return "stable://teams/current";
          },
          subscribe(listener) {
            receive = listener;
            return () => {
              receive = undefined;
            };
          },
        }}
        authenticated={() => <Text>Club home</Text>}
      />,
    );

    expect(screen.queryByText("Club home")).toBeNull();
    expect(complete.mock.calls.length).toBe(0);
    receive?.("stable://teams/current");
    expect(complete.mock.calls.length).toBe(0);
    receive?.("stable://auth/callback?code=local-code");
    expect(await screen.findByText("Club home")).toBeTruthy();
    expect(complete.mock.calls.length).toBe(1);
  });

  it("maps an unexpected restore failure to a safe recovery message", async () => {
    await render(
      <MobileAuthGate
        restore={async () => {
          throw new Error("provider returned private detail");
        }}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions()}
        authenticated={() => <Text>Club home</Text>}
      />,
    );

    expect(await screen.findByText(AUTH_ERROR_MESSAGES.INTERNAL)).toBeTruthy();
    expect(screen.queryByText("provider returned private detail")).toBeNull();
  });

  it("returns to recovery if sign-out cannot reach the provider", async () => {
    await render(
      <MobileAuthGate
        restore={async () => authenticated}
        signOut={async () => {
          throw new TypeError("network failed for private account");
        }}
        actions={idleActions()}
        authenticated={() => <Text>Club home</Text>}
      />,
    );

    await userEvent.press(await screen.findByLabelText("Sign out"));
    expect(await screen.findByText(AUTH_ERROR_MESSAGES.INTERNAL)).toBeTruthy();
    expect(screen.queryByText("private account")).toBeNull();
  });

  it("surfaces a catalog callback error without exposing its URL", async () => {
    await render(
      <MobileAuthGate
        restore={async () => ({ state: "unauthenticated" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          async completeCallback() {
            throw new ApplicationError(
              "UPSTREAM_UNAVAILABLE",
              AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
            );
          },
        })}
        linking={{
          async getInitialUrl() {
            return null;
          },
          subscribe(listener) {
            listener("stable://auth/callback?access_token=private");
            return () => undefined;
          },
        }}
        authenticated={() => <Text>Club home</Text>}
      />,
    );

    expect(
      await screen.findByText(AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE),
    ).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain("private");
  });

  it("does not trust an application error with a non-catalog message", async () => {
    await render(
      <MobileAuthGate
        restore={async () => ({ state: "unauthenticated" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          async completeCallback() {
            throw new ApplicationError("VALIDATION_FAILED", "contains a token");
          },
        })}
        linking={{
          async getInitialUrl() {
            return "stable://auth/callback?code=private";
          },
          subscribe() {
            return () => undefined;
          },
        }}
        authenticated={() => <Text>Club home</Text>}
      />,
    );

    expect(await screen.findByText(AUTH_ERROR_MESSAGES.INTERNAL)).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain("token");
  });

  it("maps a failed subscribed callback to a safe recovery message", async () => {
    let receive: ((url: string) => void) | undefined;
    await render(
      <MobileAuthGate
        restore={async () => ({ state: "unauthenticated" })}
        signOut={async () => ({ state: "unauthenticated" })}
        actions={idleActions({
          async completeCallback() {
            throw new Error("provider token=private");
          },
        })}
        linking={{
          async getInitialUrl() {
            return null;
          },
          subscribe(listener) {
            receive = listener;
            return () => undefined;
          },
        }}
        authenticated={() => <Text>Club home</Text>}
      />,
    );

    receive?.("stable://auth/callback?code=private");
    expect(await screen.findByText(AUTH_ERROR_MESSAGES.INTERNAL)).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain("private");
  });
});

function idleActions(overrides: Record<string, unknown> = {}) {
  return {
    async requestPhone() {
      return undefined;
    },
    async verifyPhone(): Promise<AuthSessionSnapshot> {
      return authenticated;
    },
    async requestEmail() {
      return undefined;
    },
    async verifyEmail(): Promise<AuthSessionSnapshot> {
      return authenticated;
    },
    async completeCallback(): Promise<AuthSessionSnapshot> {
      return authenticated;
    },
    ...overrides,
  };
}
