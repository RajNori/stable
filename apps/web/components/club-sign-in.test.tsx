import { AUTH_ERROR_MESSAGES } from "@stable/contracts";
import type { AuthSessionSnapshot } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ClubAdminShell } from "./club-admin-shell";
import { ClubSignIn, type ClubSignInActions } from "./club-sign-in";
import { SignOutControl } from "./sign-out-button";
import {
  frozenAuthProviderSettings,
  visibleAuthProviders,
  type AuthProviderSettings,
} from "../lib/provider-visibility";

const unauthenticated = {
  state: "unauthenticated",
} as const satisfies AuthSessionSnapshot;

describe("club sign-in", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the auth entry and hides disabled providers", () => {
    render(<ClubSignIn session={unauthenticated} actions={idleActions()} />);

    expect(
      screen.getByRole("heading", { name: "Know what's next. Show up ready." }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Continue with email" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Continue with Facebook" }),
    ).toBeNull();
    expect(visibleAuthProviders()).toEqual({
      google: false,
      facebook: false,
    });
  });

  it("hides a provider that is enabled without a client id or handler", () => {
    const start = async (): Promise<void> => undefined;
    render(
      <ClubSignIn
        session={unauthenticated}
        providerSettings={missingProviderConfig}
        onProvider={start}
        actions={idleActions()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Continue with Facebook" }),
    ).toBeNull();
    expect(
      visibleAuthProviders({ settings: missingProviderConfig, start }),
    ).toEqual({ google: false, facebook: false });

    cleanup();
    render(
      <ClubSignIn
        session={unauthenticated}
        providerSettings={readyProviderConfig}
        actions={idleActions()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
    expect(visibleAuthProviders({ settings: readyProviderConfig })).toEqual({
      google: false,
      facebook: false,
    });
  });

  it("shows a ready provider and invokes its start handler", async () => {
    const started: string[] = [];
    const start = async (provider: "google" | "facebook"): Promise<void> => {
      started.push(provider);
    };
    render(
      <ClubSignIn
        session={unauthenticated}
        providerSettings={readyProviderConfig}
        onProvider={start}
        actions={idleActions()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() => expect(started).toEqual(["google"]));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Facebook" }),
    );
    await waitFor(() => expect(started).toEqual(["google", "facebook"]));
    expect(
      visibleAuthProviders({ settings: readyProviderConfig, start }),
    ).toEqual({ google: true, facebook: true });
  });

  it("reads only explicit public readiness and public client IDs", () => {
    expect(
      frozenAuthProviderSettings({
        NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED: "true",
        NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: "google-public-client.apps.example",
        NEXT_PUBLIC_FACEBOOK_SIGN_IN_ENABLED: "true",
        NEXT_PUBLIC_FACEBOOK_OAUTH_CLIENT_ID: "facebook-public-app-id",
        SUPABASE_SECRET_KEY: "must-not-be-read",
      }),
    ).toEqual({
      google: {
        enabled: true,
        clientId: "google-public-client.apps.example",
      },
      facebook: { enabled: true, clientId: "facebook-public-app-id" },
    });
  });

  it("keeps error text at or above 4.5:1", () => {
    render(<ClubSignIn session={unauthenticated} actions={idleActions()} />);
    const css = document.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(
      /\.club-sign-in-error\s*\{[^}]*background:\s*var\(--sign-in-surface\)/u,
    );
    expect(css).not.toContain("--sign-in-error-soft");
    const theme = themeFor("mustangs");
    expect(
      contrastRatio(theme.color.state.error, theme.color.background.surface),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("signs in with email and password without exposing provider errors", async () => {
    const credentials: string[] = [];
    render(
      <ClubSignIn
        session={unauthenticated}
        actions={idleActions({
          async signInPassword(email, password) {
            credentials.push(email, password);
            throw new Error("GoTrue otp 654321 adult@example.com");
          },
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: " adult@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret-test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(credentials).toEqual(["adult@example.com", "secret-test-password"]);
    expect(alert.textContent).toBe(AUTH_ERROR_MESSAGES.INTERNAL);
    expect(alert.textContent?.includes("654321")).toBe(false);
    expect(alert.textContent?.includes("adult@example.com")).toBe(false);
  });

  it("shows a neutral password recovery confirmation", async () => {
    const recoveryRequests: string[] = [];
    render(
      <ClubSignIn
        session={unauthenticated}
        actions={idleActions({
          async requestPasswordRecovery(email) {
            recoveryRequests.push(email);
          },
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: " adult@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send recovery link" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain(
      "If an account can sign in with that address",
    );
    expect(recoveryRequests).toEqual(["adult@example.com"]);
    expect(screen.queryByText("adult@example.com")).toBeNull();
  });

  it("keeps admin content hidden while the session is unresolved", () => {
    const { rerender } = render(
      <ClubSignIn session={{ state: "loading" }} actions={idleActions()} />,
    );
    expect(screen.getByText("Checking your session")).toBeTruthy();
    expect(screen.queryByTestId("club-admin-frame")).toBeNull();

    rerender(
      <ClubSignIn session={{ state: "expired" }} actions={idleActions()} />,
    );
    expect(
      screen.getByText("Your session has ended. Sign in again."),
    ).toBeTruthy();

    rerender(
      <ClubSignIn
        session={{
          state: "recovery",
          errorCode: "UPSTREAM_UNAVAILABLE",
          message: AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
        }}
        actions={idleActions()}
      />,
    );
    expect(
      screen.getByText(AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Continue with email" }),
    ).toBeNull();
  });

  it("retries a recovery session and keeps busy state until the retry settles", async () => {
    let finishRetry: (() => void) | undefined;
    const retry = () =>
      new Promise<void>((resolve) => {
        finishRetry = resolve;
      });
    render(
      <ClubSignIn
        session={{
          state: "recovery",
          errorCode: "UPSTREAM_UNAVAILABLE",
          message: AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
        }}
        actions={idleActions({ retry })}
      />,
    );

    const button = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    finishRetry?.();
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
    expect(screen.getByRole("alert").textContent).toBe(
      AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
    );
  });

  it("returns to the welcome step and updates an external notice", () => {
    const { rerender } = render(
      <ClubSignIn
        session={unauthenticated}
        notice="The sign-in link has expired."
        actions={idleActions()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "The sign-in link has expired.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("button", { name: "Continue with email" }),
    ).toBeTruthy();

    rerender(
      <ClubSignIn
        session={unauthenticated}
        notice="Please try signing in again."
        actions={idleActions()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Please try signing in again.",
    );
  });

  it("hides the sign-in flow for an authenticated snapshot", () => {
    const { container } = render(
      <ClubSignIn
        session={{ state: "authenticated", principal: { userId: "adult-1" } }}
        actions={idleActions()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the admin surface only for an authenticated snapshot", () => {
    render(
      <ClubAdminShell
        presentation={{
          status: "no-membership",
          displayName: "Signed in",
          message: "No club membership is available.",
          nextStep: "Ask a club administrator for access.",
        }}
        accessory={<SignOutControl onSignOut={async () => undefined} />}
      />,
    );
    expect(screen.getByTestId("club-admin-frame")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("signs out through the supplied action", async () => {
    let signedOut = false;
    render(
      <SignOutControl
        onSignOut={async () => {
          signedOut = true;
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(signedOut).toBe(true);
    });
  });

  it("does not load club context from the page before auth resolves", () => {
    const page = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    const gate = page.indexOf("shouldLoadClubContext");
    const live = page.indexOf("loadLiveClubContext");
    expect(gate).toBeGreaterThan(-1);
    expect(live).toBeGreaterThan(gate);
    expect(page).toContain("loadClubContext");
    expect(page).not.toContain("access_token");
  });
});

const missingProviderConfig = {
  google: { enabled: true, clientId: null },
  facebook: { enabled: true, clientId: "local-test-otp" },
} as const satisfies AuthProviderSettings;

const readyProviderConfig = {
  google: { enabled: true, clientId: "unit-test-client" },
  facebook: { enabled: true, clientId: "unit-test-client" },
} as const satisfies AuthProviderSettings;

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  return (
    0.2126 * linearChannel(hex, 0) +
    0.7152 * linearChannel(hex, 1) +
    0.0722 * linearChannel(hex, 2)
  );
}

function linearChannel(hex: string, index: number): number {
  const start = index * 2 + 1;
  const parsed = Number.parseInt(hex.slice(start, start + 2), 16);
  const value = parsed / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function idleActions(
  overrides: Partial<ClubSignInActions> = {},
): ClubSignInActions {
  return {
    async signInPassword() {
      return undefined;
    },
    async retry() {
      return undefined;
    },
    async requestPasswordRecovery() {
      return undefined;
    },
    ...overrides,
  };
}
