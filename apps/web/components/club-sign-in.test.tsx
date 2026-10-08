import { ApplicationError, AUTH_ERROR_MESSAGES } from "@stable/contracts";
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
      screen.getByRole("button", { name: "Continue with mobile" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Continue with Apple" }),
    ).toBeNull();
    expect(visibleAuthProviders()).toEqual({ google: false, apple: false });
  });

  it("hides a provider that is enabled without a client id or handler", () => {
    const start = (): void => undefined;
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
      screen.queryByRole("button", { name: "Continue with Apple" }),
    ).toBeNull();
    expect(
      visibleAuthProviders({ settings: missingProviderConfig, start }),
    ).toEqual({ google: false, apple: false });

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
    expect(
      screen.queryByRole("button", { name: "Continue with Apple" }),
    ).toBeNull();
    expect(visibleAuthProviders({ settings: readyProviderConfig })).toEqual({
      google: false,
      apple: false,
    });
  });

  it("shows a ready provider and invokes its start handler", () => {
    const started: string[] = [];
    const start = (provider: "google" | "apple"): void => {
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
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Apple" }),
    );
    expect(started).toEqual(["google", "apple"]);
    expect(
      visibleAuthProviders({ settings: readyProviderConfig, start }),
    ).toEqual({ google: true, apple: true });
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

  it("requests a formatted mobile number and verifies the code", async () => {
    const calls: string[] = [];
    render(
      <ClubSignIn
        session={unauthenticated}
        actions={idleActions({
          async requestPhone(phone) {
            calls.push(phone);
          },
          async verifyPhone(phone, token) {
            calls.push(`${phone}:${token}`);
          },
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with mobile" }),
    );
    const mobileInput = screen.getByLabelText("Mobile number");
    expect(document.activeElement).toBe(mobileInput);
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "0412345678" },
    });
    expect(
      (screen.getByLabelText("Mobile number") as HTMLInputElement).value,
    ).toBe("0412 345 678");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const codeInput = await screen.findByLabelText("6-digit code");
    expect(document.activeElement).toBe(codeInput);
    fireEvent.change(codeInput, {
      target: { value: "12 34 56" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(calls).toEqual(["0412 345 678", "0412 345 678:123456"]);
    });
  });

  it("shows the application sentence for an invalid mobile", async () => {
    render(
      <ClubSignIn
        session={unauthenticated}
        actions={idleActions({
          async requestPhone() {
            throw new ApplicationError(
              "VALIDATION_FAILED",
              "Enter an Australian mobile number.",
            );
          },
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with mobile" }),
    );
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText("Enter an Australian mobile number."),
    ).toBeTruthy();
  });

  it("accepts an email and verifies the code", async () => {
    const calls: string[] = [];
    render(
      <ClubSignIn
        session={unauthenticated}
        resendCooldownSeconds={0}
        actions={idleActions({
          async requestEmail(email) {
            calls.push(email);
          },
          async verifyEmail(email, token) {
            calls.push(`${email}:${token}`);
          },
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  adult@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByLabelText("6-digit code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(calls).toEqual(["adult@example.com", "adult@example.com:123456"]);
    });
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

    await waitFor(() => {
      expect(calls).toEqual([
        "adult@example.com",
        "adult@example.com:123456",
        "adult@example.com",
      ]);
    });
  });

  it("shows a catalog sentence instead of provider text", async () => {
    render(
      <ClubSignIn
        session={unauthenticated}
        actions={idleActions({
          async verifyEmail() {
            throw new Error("GoTrue otp 654321 adult@example.com");
          },
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "adult@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByLabelText("6-digit code"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(AUTH_ERROR_MESSAGES.INTERNAL);
    expect(alert.textContent?.includes("654321")).toBe(false);
    expect(alert.textContent?.includes("adult@example.com")).toBe(false);
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
      screen.queryByRole("button", { name: "Continue with mobile" }),
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

  it("resends a phone code after cooldown and lets the adult change the number", async () => {
    const requests: string[] = [];
    render(
      <ClubSignIn
        session={unauthenticated}
        resendCooldownSeconds={1}
        actions={idleActions({
          async requestPhone(phone) {
            requests.push(phone);
          },
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with mobile" }),
    );
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "0412345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByLabelText("6-digit code")).toBeTruthy();
    expect(requests).toEqual(["0412 345 678"]);

    const cooldownButton = screen.getByRole("button", {
      name: "Resend code in 1s",
    });
    expect((cooldownButton as HTMLButtonElement).disabled).toBe(true);
    expect(
      await screen.findByRole(
        "button",
        { name: "Resend code" },
        { timeout: 2500 },
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await waitFor(() =>
      expect(requests).toEqual(["0412 345 678", "0412 345 678"]),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Change mobile number" }),
    );
    expect(screen.getByLabelText("Mobile number")).toHaveProperty(
      "value",
      "0412 345 678",
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("button", { name: "Continue with mobile" }),
    ).toBeTruthy();
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
  apple: { enabled: true, clientId: "local-test-otp" },
} as const satisfies AuthProviderSettings;

const readyProviderConfig = {
  google: { enabled: true, clientId: "unit-test-client" },
  apple: { enabled: true, clientId: "unit-test-client" },
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
    async requestPhone() {
      return undefined;
    },
    async verifyPhone() {
      return undefined;
    },
    async requestEmail() {
      return undefined;
    },
    async verifyEmail() {
      return undefined;
    },
    async retry() {
      return undefined;
    },
    ...overrides,
  };
}
