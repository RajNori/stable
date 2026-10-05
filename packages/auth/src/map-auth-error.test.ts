import { APPLICATION_ERROR_CODES, ApplicationError } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { mapAuthError } from "./index.js";

const leakedEmail = "person@example.com";
const leakedOtp = "918273";
const leakedPhone = "+61400111222";
const leakedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig";

function expectSafe(
  error: unknown,
  code: ApplicationError["code"],
  message: string,
): void {
  const mapped = mapAuthError(error);

  expect(mapped).toBeInstanceOf(ApplicationError);
  expect(mapped.code).toBe(code);
  expect(mapped.message).toBe(message);
  expect(mapped.message).not.toContain(leakedEmail);
  expect(mapped.message).not.toContain(leakedOtp);
  expect(mapped.message).not.toContain(leakedPhone);
  expect(mapped.message).not.toContain(leakedToken);
  expect(mapped.message).not.toContain("Bearer");
  expect(mapped.message).not.toContain("Apple");
  expect(mapped.message).not.toContain("Google");
}

describe("mapAuthError", () => {
  it("maps an invalid one-time code without the provider text", () => {
    expectSafe(
      new Error(`invalid OTP ${leakedOtp} for ${leakedEmail}`),
      "VALIDATION_FAILED",
      "The sign-in details could not be checked.",
    );
  });

  it("maps GoTrue OTP and OAuth callback codes to validation", () => {
    expectSafe(
      { code: "otp_expired", message: `code ${leakedOtp} expired` },
      "VALIDATION_FAILED",
      "The sign-in details could not be checked.",
    );
    expectSafe(
      {
        code: "bad_oauth_callback",
        message: `https://evil.example/callback?code=${leakedToken}`,
      },
      "VALIDATION_FAILED",
      "The sign-in details could not be checked.",
    );
    expectSafe(
      { status: 422, message: `invalid code ${leakedOtp}` },
      "VALIDATION_FAILED",
      "The sign-in details could not be checked.",
    );
    expectSafe(
      { status: 400, message: `bad request ${leakedEmail}` },
      "VALIDATION_FAILED",
      "The sign-in details could not be checked.",
    );
  });

  it("maps cancellation to validation without the provider sentence", () => {
    expectSafe(
      {
        code: "access_denied",
        message: "The user canceled the Apple authorization",
      },
      "VALIDATION_FAILED",
      "The sign-in details could not be checked.",
    );
  });

  it("maps rate limits without the phone or token", () => {
    expectSafe(
      {
        code: "over_sms_send_rate_limit",
        message: `rate limit ${leakedPhone}`,
      },
      "RATE_LIMITED",
      "Too many sign-in attempts. Wait and try again.",
    );
    expectSafe(
      { status: 429, message: `Bearer ${leakedToken}` },
      "RATE_LIMITED",
      "Too many sign-in attempts. Wait and try again.",
    );
    expectSafe(
      { status: 429 },
      "RATE_LIMITED",
      "Too many sign-in attempts. Wait and try again.",
    );
  });

  it("maps an identity collision to conflict", () => {
    expectSafe(
      {
        code: "identity_already_exists",
        message: `User already registered ${leakedEmail}`,
      },
      "CONFLICT",
      "This sign-in method can't be added.",
    );
    expectSafe(
      { status: 409, message: `phone already exists ${leakedPhone}` },
      "CONFLICT",
      "This sign-in method can't be added.",
    );
  });

  it("maps provider and network failures to unavailable", () => {
    expectSafe(
      {
        status: 503,
        message: `Apple error: invalid_client ${leakedToken}`,
      },
      "UPSTREAM_UNAVAILABLE",
      "Sign-in is unavailable right now.",
    );
    expectSafe(
      new TypeError(`Failed to fetch ${leakedEmail}`),
      "UPSTREAM_UNAVAILABLE",
      "Sign-in is unavailable right now.",
    );
    const aborted = new Error("The operation was aborted.");
    aborted.name = "AbortError";
    expectSafe(
      aborted,
      "UPSTREAM_UNAVAILABLE",
      "Sign-in is unavailable right now.",
    );
    expectSafe(
      new Error("network unavailable"),
      "UPSTREAM_UNAVAILABLE",
      "Sign-in is unavailable right now.",
    );
    expectSafe(
      { code: "request_timeout", message: "Google timeout" },
      "UPSTREAM_UNAVAILABLE",
      "Sign-in is unavailable right now.",
    );
  });

  it("maps a missing session to unauthenticated", () => {
    expectSafe(
      {
        code: "refresh_token_not_found",
        message: `refresh token ${leakedToken}`,
      },
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
    expectSafe(
      { status: 401, message: `bad jwt ${leakedToken}` },
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  });

  it("replaces every application error with a safe auth message", () => {
    const safeMessage = {
      VALIDATION_FAILED: "The sign-in details could not be checked.",
      RATE_LIMITED: "Too many sign-in attempts. Wait and try again.",
      CONFLICT: "This sign-in method can't be added.",
      UPSTREAM_UNAVAILABLE: "Sign-in is unavailable right now.",
      UNAUTHENTICATED: "Authentication is required.",
      INTERNAL: "Sign-in could not be completed.",
      FORBIDDEN: "Sign-in could not be completed.",
      NOT_FOUND: "Sign-in could not be completed.",
      STALE_WRITE: "Sign-in could not be completed.",
    } as const;
    const safeCode = {
      VALIDATION_FAILED: "VALIDATION_FAILED",
      RATE_LIMITED: "RATE_LIMITED",
      CONFLICT: "CONFLICT",
      UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
      UNAUTHENTICATED: "UNAUTHENTICATED",
      INTERNAL: "INTERNAL",
      FORBIDDEN: "INTERNAL",
      NOT_FOUND: "INTERNAL",
      STALE_WRITE: "INTERNAL",
    } as const;

    for (const code of APPLICATION_ERROR_CODES) {
      expectSafe(
        new ApplicationError(code, `leaked ${leakedEmail}`),
        safeCode[code],
        safeMessage[code],
      );
    }
  });

  it("hides unknown failures and classifies message-only provider text", () => {
    expectSafe(null, "INTERNAL", "Sign-in could not be completed.");
    expectSafe(1, "INTERNAL", "Sign-in could not be completed.");
    expectSafe(
      { status: 403, message: `Google ${leakedToken}` },
      "INTERNAL",
      "Sign-in could not be completed.",
    );
    expectSafe(
      { code: "unexpected_shape", message: `Google ${leakedToken}` },
      "INTERNAL",
      "Sign-in could not be completed.",
    );
    expectSafe(
      new Error(`too many requests for ${leakedPhone}`),
      "RATE_LIMITED",
      "Too many sign-in attempts. Wait and try again.",
    );
    expectSafe(
      new Error(`User already registered ${leakedEmail}`),
      "CONFLICT",
      "This sign-in method can't be added.",
    );
  });
});
