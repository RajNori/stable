import {
  AUTH_ERROR_MESSAGES,
  authErrorCodeSchema,
  authSessionSnapshotSchema,
  type AuthSessionSnapshot,
  type LogoutScope,
} from "@stable/contracts";

import { mapAuthError } from "./map-auth-error.js";
import { principalFromSession } from "./principal-from-session.js";

export type StoredPrincipalFact = {
  readonly userId: string;
  readonly displayName?: string;
  readonly accessExpiresAt: number | null;
};

export type PersistedSessionRead =
  | { readonly kind: "none" }
  | { readonly kind: "corrupt" }
  | { readonly kind: "expired" }
  | { readonly kind: "unavailable"; readonly error: unknown }
  | { readonly kind: "principal"; readonly principal: StoredPrincipalFact };

export type AuthSessionGateway = {
  readPersisted(): Promise<PersistedSessionRead>;
  refresh(): Promise<PersistedSessionRead>;
  revoke(scope: LogoutScope): Promise<void>;
  clearLocal(): Promise<void>;
};

export type AuthSessionDecision = {
  readonly snapshot: AuthSessionSnapshot;
  readonly clearLocal: boolean;
};

const UNAUTHENTICATED = {
  state: "unauthenticated",
} as const satisfies AuthSessionSnapshot;

const EXPIRED = { state: "expired" } as const satisfies AuthSessionSnapshot;

/**
 * Classifies a provider failure for session restore and refresh.
 * Credential and expiry failures become `expired`. Other failures stay `unavailable`
 * so a network outage is not reported as logout.
 */
export function providerFailureRead(error: unknown): PersistedSessionRead {
  const code = mapAuthError(error).code;
  if (code === "UNAUTHENTICATED" || code === "VALIDATION_FAILED") {
    return { kind: "expired" };
  }

  return { kind: "unavailable", error };
}

function recoverySnapshot(error: unknown): AuthSessionSnapshot {
  const mapped = mapAuthError(error);
  const parsedCode = authErrorCodeSchema.safeParse(mapped.code);
  const errorCode = parsedCode.success ? parsedCode.data : "INTERNAL";
  return authSessionSnapshotSchema.parse({
    state: "recovery",
    errorCode,
    message: AUTH_ERROR_MESSAGES[errorCode],
  });
}

function authenticatedSnapshot(
  fact: StoredPrincipalFact,
): AuthSessionSnapshot | null {
  const identity =
    fact.displayName === undefined
      ? { userId: fact.userId }
      : { userId: fact.userId, displayName: fact.displayName };
  const principal = principalFromSession(identity);
  if (principal === null) {
    return null;
  }

  return { state: "authenticated", principal };
}

function accessStillValid(fact: StoredPrincipalFact, now: number): boolean {
  return fact.accessExpiresAt === null || fact.accessExpiresAt > now;
}

async function cleared(
  gateway: AuthSessionGateway,
  snapshot: AuthSessionSnapshot,
): Promise<AuthSessionDecision> {
  try {
    await gateway.clearLocal();
  } catch (error) {
    return { snapshot: recoverySnapshot(error), clearLocal: false };
  }

  return { snapshot, clearLocal: true };
}

async function decideRead(
  gateway: AuthSessionGateway,
  read: PersistedSessionRead,
  now: number,
  allowRefresh: boolean,
): Promise<AuthSessionDecision> {
  if (read.kind === "none") {
    return { snapshot: UNAUTHENTICATED, clearLocal: false };
  }

  if (read.kind === "corrupt") {
    return cleared(gateway, UNAUTHENTICATED);
  }

  if (read.kind === "expired") {
    return cleared(gateway, EXPIRED);
  }

  if (read.kind === "unavailable") {
    return { snapshot: recoverySnapshot(read.error), clearLocal: false };
  }

  const snapshot = authenticatedSnapshot(read.principal);
  if (snapshot === null) {
    return cleared(gateway, UNAUTHENTICATED);
  }

  if (!allowRefresh || accessStillValid(read.principal, now)) {
    return { snapshot, clearLocal: false };
  }

  try {
    const refreshed = await gateway.refresh();
    return decideRead(gateway, refreshed, now, false);
  } catch (error) {
    return { snapshot: recoverySnapshot(error), clearLocal: false };
  }
}

export async function restoreAuthSession(
  gateway: AuthSessionGateway,
  now: number = Date.now(),
): Promise<AuthSessionDecision> {
  try {
    const read = await gateway.readPersisted();
    return decideRead(gateway, read, now, true);
  } catch (error) {
    return { snapshot: recoverySnapshot(error), clearLocal: false };
  }
}

export async function refreshAuthSession(
  gateway: AuthSessionGateway,
  now: number = Date.now(),
): Promise<AuthSessionDecision> {
  try {
    const read = await gateway.refresh();
    return decideRead(gateway, read, now, false);
  } catch (error) {
    return { snapshot: recoverySnapshot(error), clearLocal: false };
  }
}

export async function signOutAuthSession(
  gateway: AuthSessionGateway,
  scope: LogoutScope,
): Promise<AuthSessionDecision> {
  let revokeError: unknown = null;
  try {
    await gateway.revoke(scope);
  } catch (error) {
    revokeError = error;
  }

  let read: PersistedSessionRead;
  try {
    read = await gateway.readPersisted();
  } catch (error) {
    return {
      snapshot: recoverySnapshot(revokeError ?? error),
      clearLocal: false,
    };
  }

  let didClear = false;
  if (read.kind === "principal") {
    try {
      await gateway.clearLocal();
      didClear = true;
    } catch (error) {
      return {
        snapshot: recoverySnapshot(revokeError ?? error),
        clearLocal: false,
      };
    }

    try {
      read = await gateway.readPersisted();
    } catch (error) {
      return {
        snapshot: recoverySnapshot(revokeError ?? error),
        clearLocal: true,
      };
    }
  }

  if (read.kind === "none") {
    return { snapshot: UNAUTHENTICATED, clearLocal: didClear };
  }

  if (read.kind === "corrupt" || read.kind === "expired") {
    if (!didClear) {
      const decision = await cleared(gateway, UNAUTHENTICATED);
      return decision;
    }

    return { snapshot: UNAUTHENTICATED, clearLocal: true };
  }

  const remaining =
    revokeError ?? (read.kind === "unavailable" ? read.error : { status: 401 });
  return { snapshot: recoverySnapshot(remaining), clearLocal: didClear };
}
