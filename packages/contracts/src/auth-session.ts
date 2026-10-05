import { z } from "zod";

import { principalSchema } from "./principal.js";

export const AUTH_STATES = [
  "loading",
  "authenticated",
  "unauthenticated",
  "expired",
  "recovery",
] as const;

export const authStateSchema = z.enum(AUTH_STATES);

export type AuthState = z.infer<typeof authStateSchema>;

export const LOGOUT_SCOPES = ["local", "global"] as const;

export const logoutScopeSchema = z.enum(LOGOUT_SCOPES);

export type LogoutScope = z.infer<typeof logoutScopeSchema>;

export const AUTH_ERROR_CODES = [
  "VALIDATION_FAILED",
  "RATE_LIMITED",
  "CONFLICT",
  "UPSTREAM_UNAVAILABLE",
  "UNAUTHENTICATED",
  "INTERNAL",
] as const;

export const authErrorCodeSchema = z.enum(AUTH_ERROR_CODES);

export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;

export const AUTH_ERROR_MESSAGES = {
  VALIDATION_FAILED: "The sign-in details could not be checked.",
  RATE_LIMITED: "Too many sign-in attempts. Wait and try again.",
  CONFLICT: "This sign-in method can't be added.",
  UPSTREAM_UNAVAILABLE: "Sign-in is unavailable right now.",
  UNAUTHENTICATED: "Authentication is required.",
  INTERNAL: "Sign-in could not be completed.",
} as const satisfies Record<AuthErrorCode, string>;

export const AUTH_METHODS = [
  "phone_otp",
  "email_otp",
  "apple",
  "google",
] as const;

export const authMethodSchema = z.enum(AUTH_METHODS);

export type AuthMethod = z.infer<typeof authMethodSchema>;

export const authSessionSnapshotSchema = z
  .discriminatedUnion("state", [
    z.strictObject({ state: z.literal("loading") }),
    z.strictObject({
      state: z.literal("authenticated"),
      principal: principalSchema,
    }),
    z.strictObject({ state: z.literal("unauthenticated") }),
    z.strictObject({ state: z.literal("expired") }),
    z.strictObject({
      state: z.literal("recovery"),
      errorCode: authErrorCodeSchema,
      message: z.string(),
    }),
  ])
  .superRefine((value, context) => {
    if (
      value.state === "recovery" &&
      value.message !== AUTH_ERROR_MESSAGES[value.errorCode]
    ) {
      context.addIssue({
        code: "custom",
        message: "Recovery message must be the catalog sentence.",
        path: ["message"],
      });
    }
  });

export type AuthSessionSnapshot = z.infer<typeof authSessionSnapshotSchema>;

export const INITIAL_AUTH_SESSION = {
  state: "loading",
} as const satisfies AuthSessionSnapshot;
