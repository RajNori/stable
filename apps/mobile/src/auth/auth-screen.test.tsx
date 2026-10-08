import { ApplicationError, AUTH_ERROR_MESSAGES } from "@stable/contracts";
import type { AuthSessionSnapshot } from "@stable/contracts";
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import { AuthScreen, type AuthActions } from "./auth-screen";
import {
  requestVisibleProvider,
  visibleAuthProviders,
  type AuthProviderSettings,
} from "./provider-visibility";

const unauthenticated = {
  state: "unauthenticated",
} as const satisfies AuthSessionSnapshot;

describe("mobile auth screen", () => {
  it("shows the welcome entry and hides disabled providers", async () => {
    const started: string[] = [];
    await render(
      <AuthScreen
        session={unauthenticated}
        actions={idleActions()}
        onProvider={(provider) => {
          started.push(provider);
        }}
      />,
    );

    expect(screen.getByText("Know what's next. Show up ready.")).toBeTruthy();
    expect(screen.getByLabelText("Continue with mobile")).toBeTruthy();
    expect(screen.getByLabelText("Continue with email")).toBeTruthy();
    expect(screen.queryByLabelText("Continue with Google")).toBeNull();
    expect(screen.queryByLabelText("Continue with Apple")).toBeNull();
    expect(started).toEqual([]);
    expect(visibleAuthProviders()).toEqual({ google: false, apple: false });
  });

  it("does not invoke a disabled provider", () => {
    let called = false;
    requestVisibleProvider("google", () => {
      called = true;
    });
    requestVisibleProvider("apple", () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it("hides an enabled provider until configuration and a handler are both present", async () => {
    const started: string[] = [];
    const start = (provider: "google" | "apple"): void => {
      started.push(provider);
    };
    const { rerender } = await render(
      <AuthScreen
        session={unauthenticated}
        providerSettings={missingProviderConfig}
        onProvider={start}
        actions={idleActions()}
      />,
    );
    expect(screen.queryByLabelText("Continue with Google")).toBeNull();
    expect(screen.queryByLabelText("Continue with Apple")).toBeNull();
    expect(
      visibleAuthProviders({ settings: missingProviderConfig, start }),
    ).toEqual({ google: false, apple: false });

    await rerender(
      <AuthScreen
        session={unauthenticated}
        providerSettings={readyProviderConfig}
        actions={idleActions()}
      />,
    );
    expect(screen.queryByLabelText("Continue with Google")).toBeNull();
    expect(screen.queryByLabelText("Continue with Apple")).toBeNull();
    expect(visibleAuthProviders({ settings: readyProviderConfig })).toEqual({
      google: false,
      apple: false,
    });

    requestVisibleProvider("google", start, missingProviderConfig.google);
    requestVisibleProvider("apple", start, {
      enabled: true,
      clientId: "local-test-otp",
    });
    requestVisibleProvider("google", start, {
      enabled: false,
      clientId: "unit-test-client",
    });
    expect(started).toEqual([]);
  });

  it("shows a ready provider and invokes its start handler", async () => {
    const started: string[] = [];
    const start = (provider: "google" | "apple"): void => {
      started.push(provider);
    };
    await render(
      <AuthScreen
        session={unauthenticated}
        providerSettings={readyProviderConfig}
        onProvider={start}
        actions={idleActions()}
      />,
    );

    await userEvent.press(screen.getByLabelText("Continue with Google"));
    await userEvent.press(screen.getByLabelText("Continue with Apple"));
    expect(started).toEqual(["google", "apple"]);
    expect(
      visibleAuthProviders({ settings: readyProviderConfig, start }),
    ).toEqual({ google: true, apple: true });
    requestVisibleProvider("google", start, readyProviderConfig.google);
    expect(started).toEqual(["google", "apple", "google"]);
  });

  it("exposes auth titles as headings", async () => {
    await render(
      <AuthScreen session={unauthenticated} actions={idleActions()} />,
    );
    expect(
      screen.getByRole("header", {
        name: "Know what's next. Show up ready.",
      }),
    ).toBeTruthy();

    await userEvent.press(screen.getByLabelText("Continue with mobile"));
    expect(screen.getByRole("header", { name: "Your mobile" })).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Mobile number"), "0412345678");
    await userEvent.press(screen.getByLabelText("Continue"));
    expect(screen.getByRole("header", { name: "Enter the code" })).toBeTruthy();

    await userEvent.press(screen.getByLabelText("Change mobile number"));
    await userEvent.press(screen.getByLabelText("Back"));
    await userEvent.press(screen.getByLabelText("Continue with email"));
    expect(screen.getByRole("header", { name: "Your email" })).toBeTruthy();
    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "adult@example.com",
    );
    await userEvent.press(screen.getByLabelText("Send code"));
    expect(screen.getByRole("header", { name: "Enter the code" })).toBeTruthy();
  });

  it("formats a mobile number and requests a code", async () => {
    const calls: string[] = [];
    await render(
      <AuthScreen
        session={unauthenticated}
        actions={idleActions({
          async requestPhone(phone) {
            calls.push(phone);
          },
        })}
      />,
    );

    await userEvent.press(screen.getByLabelText("Continue with mobile"));
    fireEvent.changeText(screen.getByLabelText("Mobile number"), "0412345678");
    await waitFor(() => {
      expect(screen.getByLabelText("Mobile number").props.value).toBe(
        "0412 345 678",
      );
    });
    await userEvent.press(screen.getByLabelText("Continue"));

    await screen.findByLabelText("6-digit code");
    expect(calls).toEqual(["0412 345 678"]);
  });

  it("shows the application message for an invalid mobile and ignores provider text", async () => {
    await render(
      <AuthScreen
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

    await userEvent.press(screen.getByLabelText("Continue with mobile"));
    fireEvent.changeText(screen.getByLabelText("Mobile number"), "123");
    await userEvent.press(screen.getByLabelText("Continue"));

    expect(
      await screen.findByText("Enter an Australian mobile number."),
    ).toBeTruthy();
  });

  it("verifies a pasted phone code, resends, and returns to the number", async () => {
    const phones: string[] = [];
    const codes: string[] = [];
    await render(
      <AuthScreen
        session={unauthenticated}
        resendCooldownSeconds={0}
        actions={idleActions({
          async requestPhone(phone) {
            phones.push(phone);
          },
          async verifyPhone(phone, token) {
            codes.push(`${phone}:${token}`);
          },
        })}
      />,
    );

    await userEvent.press(screen.getByLabelText("Continue with mobile"));
    fireEvent.changeText(screen.getByLabelText("Mobile number"), "0412345678");
    await userEvent.press(screen.getByLabelText("Continue"));
    const code = await screen.findByLabelText("6-digit code");
    fireEvent.changeText(code, "123 456");
    await userEvent.press(screen.getByLabelText("Continue"));
    await screen.findByText("Sent to 0412 345 678");
    expect(codes).toEqual(["0412 345 678:123456"]);
    expect(screen.getByLabelText("6-digit code").props.value).toBe("");

    await userEvent.press(screen.getByLabelText("Resend code"));
    await screen.findByLabelText("Resend code");
    expect(phones).toEqual(["0412 345 678", "0412 345 678"]);

    await userEvent.press(screen.getByLabelText("Change mobile number"));
    expect(screen.getByLabelText("Mobile number")).toBeTruthy();
  });

  it("shows catalog sentences for an invalid or expired code", async () => {
    await render(
      <AuthScreen
        session={unauthenticated}
        actions={idleActions({
          async verifyPhone() {
            throw new Error("otp 654321 expired for +61412345678");
          },
        })}
      />,
    );

    await userEvent.press(screen.getByLabelText("Continue with mobile"));
    fireEvent.changeText(screen.getByLabelText("Mobile number"), "0412345678");
    await userEvent.press(screen.getByLabelText("Continue"));
    fireEvent.changeText(
      await screen.findByLabelText("6-digit code"),
      "000000",
    );
    await userEvent.press(screen.getByLabelText("Continue"));

    expect(await screen.findByText(AUTH_ERROR_MESSAGES.INTERNAL)).toBeTruthy();
    expect(screen.queryByText(/654321/)).toBeNull();
    expect(screen.queryByText(/\+614/)).toBeNull();
  });

  it("accepts an email and verifies the code", async () => {
    const emails: string[] = [];
    await render(
      <AuthScreen
        session={unauthenticated}
        actions={idleActions({
          async requestEmail(email) {
            emails.push(email);
          },
          async verifyEmail(email, token) {
            emails.push(`${email}:${token}`);
          },
        })}
      />,
    );

    await userEvent.press(screen.getByLabelText("Continue with email"));
    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "  adult@example.com",
    );
    await userEvent.press(screen.getByLabelText("Send code"));
    fireEvent.changeText(
      await screen.findByLabelText("6-digit code"),
      "123456",
    );
    await userEvent.press(screen.getByLabelText("Continue"));

    expect(await screen.findByText("Sent to adult@example.com")).toBeTruthy();
    expect(emails).toEqual(["adult@example.com", "adult@example.com:123456"]);
  });

  it("changes and resends an email code without retaining the previous code", async () => {
    const requests: string[] = [];
    await render(
      <AuthScreen
        session={unauthenticated}
        resendCooldownSeconds={0}
        actions={idleActions({
          async requestEmail(email) {
            requests.push(email);
          },
        })}
      />,
    );

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
    await userEvent.press(screen.getByLabelText("Change email"));
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.queryByLabelText("6-digit code")).toBeNull();
    await userEvent.press(screen.getByLabelText("Back"));
    expect(screen.getByLabelText("Continue with email")).toBeTruthy();

    await userEvent.press(screen.getByLabelText("Continue with email"));
    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "adult@example.com",
    );
    await userEvent.press(screen.getByLabelText("Send code"));
    await screen.findByLabelText("6-digit code");
    await userEvent.press(screen.getByLabelText("Resend code"));
    expect(requests).toEqual([
      "adult@example.com",
      "adult@example.com",
      "adult@example.com",
    ]);
  });

  it("shows a catalog sentence for an invalid email", async () => {
    await render(
      <AuthScreen
        session={unauthenticated}
        actions={idleActions({
          async requestEmail() {
            throw new ApplicationError(
              "VALIDATION_FAILED",
              AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
            );
          },
        })}
      />,
    );

    await userEvent.press(screen.getByLabelText("Continue with email"));
    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "not-an-email",
    );
    await userEvent.press(screen.getByLabelText("Send code"));

    expect(
      await screen.findByText(AUTH_ERROR_MESSAGES.VALIDATION_FAILED),
    ).toBeTruthy();
  });

  it("renders loading, expired, and recovery without a second auth flag", async () => {
    const { rerender } = await render(
      <AuthScreen session={{ state: "loading" }} actions={idleActions()} />,
    );
    expect(screen.getByText("Checking your session")).toBeTruthy();
    expect(screen.queryByLabelText("Continue with mobile")).toBeNull();

    await rerender(
      <AuthScreen session={{ state: "expired" }} actions={idleActions()} />,
    );
    expect(
      screen.getByText("Your session has ended. Sign in again."),
    ).toBeTruthy();
    expect(
      screen.getByRole("header", {
        name: "Know what's next. Show up ready.",
      }),
    ).toBeTruthy();

    const retry = idleActions();
    await rerender(
      <AuthScreen
        session={{
          state: "recovery",
          errorCode: "UPSTREAM_UNAVAILABLE",
          message: AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
        }}
        actions={retry}
      />,
    );
    expect(
      screen.getByText(AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE),
    ).toBeTruthy();
    expect(
      screen.getByRole("header", { name: "Sign-in is paused" }),
    ).toBeTruthy();
    await userEvent.press(screen.getByLabelText("Try again"));
    expect(screen.queryByLabelText("Continue with mobile")).toBeNull();
  });

  it("disables continue while a mobile request is in flight", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await render(
      <AuthScreen
        session={unauthenticated}
        actions={idleActions({
          async requestPhone() {
            await pending;
          },
        })}
      />,
    );

    await userEvent.press(screen.getByLabelText("Continue with mobile"));
    fireEvent.changeText(screen.getByLabelText("Mobile number"), "0412345678");
    await userEvent.press(screen.getByLabelText("Continue"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Continue").props.accessibilityState,
      ).toMatchObject({ disabled: true });
    });
    if (release !== undefined) {
      release();
    }
    expect(await screen.findByLabelText("6-digit code")).toBeTruthy();
  });

  it("renders nothing once the session is authenticated", async () => {
    await render(
      <AuthScreen
        session={{
          state: "authenticated",
          principal: { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        }}
        actions={idleActions()}
      />,
    );
    expect(screen.queryByText("The Stable")).toBeNull();
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

function idleActions(overrides: Partial<AuthActions> = {}): AuthActions {
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
