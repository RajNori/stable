import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  signInChallengeSchema,
  type AppEnv,
  type AuthSessionSnapshot,
  type SignInChallenge,
} from "@stable/contracts";

import {
  assertAllowedSignInRedirect,
  assertSafeReturnPath,
  authCodeFromCallback,
} from "./auth-redirect.js";
import { mapAuthError } from "./map-auth-error.js";
import { normalizeAustralianMobile } from "./australian-mobile.js";
import { type OtpAuthClient, type OtpProviderUser } from "./otp-auth-client.js";
import { principalFromSession } from "./principal-from-session.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CompletedEmailSignIn = {
  readonly snapshot: AuthSessionSnapshot;
  readonly returnTo: string;
};

function validationFailed(): ApplicationError {
  return new ApplicationError(
    "VALIDATION_FAILED",
    AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
  );
}

function assertEmail(email: string): string {
  const trimmed = email.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 254 ||
    !EMAIL_PATTERN.test(trimmed)
  ) {
    throw validationFailed();
  }

  return trimmed;
}

function assertOneTimeCode(token: string): string {
  if (!/^\d{6}$/.test(token)) {
    throw validationFailed();
  }

  return token;
}

async function fromProvider<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw mapAuthError(error);
  }
}

function authenticatedSnapshot(user: OtpProviderUser): AuthSessionSnapshot {
  const identity =
    user.displayName === undefined
      ? { id: user.id }
      : { id: user.id, displayName: user.displayName };
  const principal = principalFromSession(identity);
  if (principal === null) {
    throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
  }

  return { state: "authenticated", principal };
}

export async function requestEmailSignIn(
  client: OtpAuthClient,
  input: { email: string; redirectTo: string; appEnv: AppEnv },
): Promise<SignInChallenge> {
  const email = assertEmail(input.email);
  const redirectTo = assertAllowedSignInRedirect(
    input.redirectTo,
    input.appEnv,
  );
  await fromProvider(() => client.requestEmailOtp({ email, redirectTo }));
  return signInChallengeSchema.parse({
    status: "accepted",
    method: "email_otp",
  });
}

export async function verifyEmailOtp(
  client: OtpAuthClient,
  input: { email: string; token: string },
): Promise<AuthSessionSnapshot> {
  const email = assertEmail(input.email);
  const token = assertOneTimeCode(input.token);
  const user = await fromProvider(() =>
    client.verifyEmailOtp({ email, token }),
  );
  return authenticatedSnapshot(user);
}

export async function completeEmailCallback(
  client: OtpAuthClient,
  input: { callbackUrl: string; appEnv: AppEnv; returnTo?: string },
): Promise<CompletedEmailSignIn> {
  const returnTo = assertSafeReturnPath(input.returnTo ?? "/");
  const code = authCodeFromCallback(input.callbackUrl, input.appEnv);
  const user = await fromProvider(() => client.exchangeEmailCode({ code }));
  return { snapshot: authenticatedSnapshot(user), returnTo };
}

export async function requestPhoneOtp(
  client: OtpAuthClient,
  input: { phone: string },
): Promise<SignInChallenge> {
  const phoneE164 = normalizeAustralianMobile(input.phone);
  await fromProvider(() => client.requestPhoneOtp({ phoneE164 }));
  return signInChallengeSchema.parse({
    status: "accepted",
    method: "phone_otp",
  });
}

export async function verifyPhoneOtp(
  client: OtpAuthClient,
  input: { phone: string; token: string },
): Promise<AuthSessionSnapshot> {
  const phoneE164 = normalizeAustralianMobile(input.phone);
  const token = assertOneTimeCode(input.token);
  const user = await fromProvider(() =>
    client.verifyPhoneOtp({ phoneE164, token }),
  );
  return authenticatedSnapshot(user);
}
