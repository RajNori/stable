import { ApplicationError, AUTH_ERROR_MESSAGES } from "@stable/contracts";
import type { AuthSessionSnapshot } from "@stable/contracts";
import { QueryClient } from "@tanstack/react-query";
import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

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
  });

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
