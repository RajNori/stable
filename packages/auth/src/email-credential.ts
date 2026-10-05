import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  authSessionSnapshotSchema,
  emailCredentialChangeSchema,
  type AppEnv,
  type AuthSessionSnapshot,
  type EmailCredentialChange,
  type Principal,
} from "@stable/contracts";

import { assertAllowedSignInRedirect } from "./auth-redirect.js";
import {
  decideIdentityLink,
  type EmailChangeMode,
} from "./identity-link-policy.js";
import { mapAuthError } from "./map-auth-error.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Local confirms both the current and new address.
 * Staging and production stay unset until that environment sets a mode.
 */
export const EMAIL_CHANGE_MODE_BY_ENV = {
  local: "double_confirm",
  staging: "unset",
  production: "unset",
} as const satisfies Record<AppEnv, EmailChangeMode>;

export type EmailCredentialGateway = {
  requestEmailChange(input: {
    email: string;
    redirectTo: string;
  }): Promise<{ userId: string }>;
  verifyEmailChange(input: {
    email: string;
    token: string;
  }): Promise<{ userId: string; established: boolean }>;
};

export async function requestEmailCredentialChange(
  gateway: EmailCredentialGateway,
  input: {
    principal: Principal | null;
    email: string;
    redirectTo: string;
    appEnv: AppEnv;
  },
): Promise<EmailCredentialChange> {
  const principal = requirePrincipal(input.principal);
  const email = assertEmail(input.email);
  const redirectTo = assertAllowedSignInRedirect(
    input.redirectTo,
    input.appEnv,
  );
  assertEmailChangeOpen(input.appEnv, false);
  const changed = await fromProvider(() =>
    gateway.requestEmailChange({ email, redirectTo }),
  );
  assertSameAdult(changed.userId, principal.userId);
  return emailCredentialChangeSchema.parse({
    status: "pending",
    userId: principal.userId,
  });
}

export async function verifyEmailCredentialChange(
  gateway: EmailCredentialGateway,
  input: {
    principal: Principal | null;
    email: string;
    token: string;
    appEnv: AppEnv;
  },
): Promise<EmailCredentialChange> {
  const principal = requirePrincipal(input.principal);
  const email = assertEmail(input.email);
  const token = assertOneTimeCode(input.token);
  assertEmailChangeOpen(input.appEnv, false);
  const verified = await fromProvider(() =>
    gateway.verifyEmailChange({ email, token }),
  );
  assertSameAdult(verified.userId, principal.userId);
  assertEmailChangeOpen(input.appEnv, verified.established);
  return emailCredentialChangeSchema.parse({
    status: verified.established ? "established" : "pending",
    userId: principal.userId,
  });
}

export function cancelEmailCredentialChange(
  principal: Principal | null,
): AuthSessionSnapshot {
  return authSessionSnapshotSchema.parse({
    state: "authenticated",
    principal: requirePrincipal(principal),
  });
}

function assertEmailChangeOpen(
  appEnv: AppEnv,
  verificationCompleted: boolean,
): void {
  const decision = decideIdentityLink({
    kind: "email_change",
    authenticated: true,
    candidateOwnedByOtherUser: false,
    emailChangeMode: EMAIL_CHANGE_MODE_BY_ENV[appEnv],
    verificationCompleted,
  });
  if (decision.application === "refuse") {
    throw new ApplicationError(
      decision.errorCode,
      AUTH_ERROR_MESSAGES[decision.errorCode],
    );
  }
  if (
    decision.application !== "allow_explicit_link" ||
    decision.credentialEstablished !== verificationCompleted
  ) {
    throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      AUTH_ERROR_MESSAGES.UNAUTHENTICATED,
    );
  }
  return principal;
}

function assertSameAdult(userId: string, expected: string): void {
  if (userId !== expected) {
    throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
  }
}

function assertEmail(email: string): string {
  const trimmed = email.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 254 ||
    !EMAIL_PATTERN.test(trimmed)
  ) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    );
  }
  return trimmed;
}

function assertOneTimeCode(token: string): string {
  if (!/^\d{6}$/.test(token)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    );
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
