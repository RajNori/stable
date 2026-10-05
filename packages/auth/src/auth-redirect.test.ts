import { ApplicationError } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  LOCAL_SIGN_IN_REDIRECTS,
  assertAllowedSignInRedirect,
  assertSafeReturnPath,
  authCodeFromCallback,
} from "./auth-redirect.js";

const webCallback = "http://127.0.0.1:3000/auth/callback";
const mobileCallback = "stable://auth/callback";
const code = "abcdefghijklmnop";

describe("sign-in redirects", () => {
  it("allows the local web and mobile callbacks only", () => {
    expect(LOCAL_SIGN_IN_REDIRECTS).toEqual([webCallback, mobileCallback]);
    expect(assertAllowedSignInRedirect(webCallback, "local")).toBe(webCallback);
    expect(assertAllowedSignInRedirect(mobileCallback, "local")).toBe(
      mobileCallback,
    );
  });

  it.each([
    "https://evil.example/auth/callback",
    "javascript:alert(1)",
    "data:text/html,hi",
    "http://127.0.0.1:3000/auth/callback.evil",
    "http://127.0.0.1:3000",
    "",
    `${webCallback}?next=https://evil.example`,
  ])("rejects redirect %j", (redirectTo) => {
    expect(() => assertAllowedSignInRedirect(redirectTo, "local")).toThrow(
      ApplicationError,
    );
    const message = rejection(redirectTo);
    expect(message).toBe("The sign-in details could not be checked.");
    if (redirectTo.length > 0) {
      expect(message.includes(redirectTo)).toBe(false);
    }
  });

  it("rejects every redirect outside local", () => {
    expect(() => assertAllowedSignInRedirect(webCallback, "staging")).toThrow(
      ApplicationError,
    );
    expect(() =>
      assertAllowedSignInRedirect(webCallback, "production"),
    ).toThrow(ApplicationError);
  });

  it("accepts an internal return path", () => {
    expect(assertSafeReturnPath("/club-structure")).toBe("/club-structure");
  });

  it.each([
    "",
    "x".repeat(201),
    "club-structure",
    "//evil.example",
    "/\\evil",
    "/club\\admin",
    "/auth:callback",
    "/club structure",
    "/next/%2F%2Fevil.example",
    "/next/%5Cevil",
    "/javascript",
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://evil.example",
  ])("rejects return path %j", (returnTo) => {
    expect(() => assertSafeReturnPath(returnTo)).toThrow(ApplicationError);
    const message = returnPathMessage(returnTo);
    expect(message).toBe("The sign-in details could not be checked.");
    if (returnTo.length > 0 && returnTo.length <= 200) {
      expect(message.includes(returnTo)).toBe(false);
    }
  });

  it("reads a code from the local web and mobile callbacks", () => {
    expect(authCodeFromCallback(`${webCallback}?code=${code}`, "local")).toBe(
      code,
    );
    expect(authCodeFromCallback(`${webCallback}/?code=${code}`, "local")).toBe(
      code,
    );
    expect(
      authCodeFromCallback(`${mobileCallback}?code=${code}`, "local"),
    ).toBe(code);
  });

  it.each([
    "not a url",
    `javascript:alert(1)?code=${code}`,
    `https://evil.example/auth/callback?code=${code}`,
    `http://user:secret@127.0.0.1:3000/auth/callback?code=${code}`,
    `${webCallback}?code=${code}#access_token=secret-access-token`,
    `${webCallback}?code=${code}&access_token=secret-access-token`,
    `${webCallback}?code=short`,
    `${webCallback}?state=ok`,
    webCallback,
  ])(
    "rejects callback %j when it is not a local code exchange",
    (callbackUrl) => {
      const appEnv = "local" as const;
      expect(() => authCodeFromCallback(callbackUrl, appEnv)).toThrow(
        ApplicationError,
      );
      const message = callbackMessage(callbackUrl, appEnv);
      expect(message).toBe("The sign-in details could not be checked.");
      expect(message.includes(code)).toBe(false);
      expect(message.includes("secret-access-token")).toBe(false);
    },
  );

  it("rejects a local callback when the environment is not local", () => {
    expect(() =>
      authCodeFromCallback(`${webCallback}?code=${code}`, "production"),
    ).toThrow(ApplicationError);
  });
});

function rejection(redirectTo: string): string {
  try {
    assertAllowedSignInRedirect(redirectTo, "local");
  } catch (error) {
    if (error instanceof ApplicationError) {
      return error.message;
    }
  }
  return "";
}

function returnPathMessage(returnTo: string): string {
  try {
    assertSafeReturnPath(returnTo);
  } catch (error) {
    if (error instanceof ApplicationError) {
      return error.message;
    }
  }
  return "";
}

function callbackMessage(
  callbackUrl: string,
  appEnv: "local" | "staging",
): string {
  try {
    authCodeFromCallback(callbackUrl, appEnv);
  } catch (error) {
    if (error instanceof ApplicationError) {
      return error.message;
    }
  }
  return "";
}
