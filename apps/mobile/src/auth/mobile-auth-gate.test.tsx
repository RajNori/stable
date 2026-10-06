import { ApplicationError, AUTH_ERROR_MESSAGES } from "@stable/contracts";
import type { AuthSessionSnapshot } from "@stable/contracts";
import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import { MobileAuthGate } from "./mobile-auth-gate";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const authenticated = {
  state: "authenticated",
  principal: { userId },
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
