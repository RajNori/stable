import {
  clearPendingPushCleanup,
  readPendingPushCleanupUsers,
  type PendingPushCleanupStore,
} from "./pending-push-cleanup";

export type PreviousPushSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
};

export async function cleanPendingCallbackPushRegistration(input: {
  readonly store: PendingPushCleanupStore;
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly removeRegistration: (
    userId: string,
    accessToken: string,
    refreshToken: string,
  ) => Promise<void | boolean>;
}): Promise<boolean> {
  const pendingUsers = await readPendingPushCleanupUsers(input.store);
  if (!pendingUsers.includes(input.userId)) return false;

  const removed = await input.removeRegistration(
    input.userId,
    input.accessToken,
    input.refreshToken,
  );
  if (removed === false) {
    throw new Error("The previous account push endpoint is unresolved.");
  }
  await clearPendingPushCleanup(input.store, input.userId);
  return true;
}

export async function removePreviousPushAfterSuccessfulAccountSwitch(
  previous: PreviousPushSession | null,
  nextUserId: string,
  removeRegistration: (
    userId: string,
    accessToken: string,
    refreshToken: string,
  ) => Promise<void | boolean>,
  registrationAlreadyCleaned = false,
): Promise<boolean> {
  if (
    previous === null ||
    previous.userId === nextUserId ||
    registrationAlreadyCleaned
  ) {
    return true;
  }
  const removed = await removeRegistration(
    previous.userId,
    previous.accessToken,
    previous.refreshToken,
  );
  return removed !== false;
}

/**
 * A failed account-transition cleanup must leave no restorable local session.
 * Supabase signOut can resolve with an error object, so callers must clear the
 * persisted session themselves in that case (and when signOut throws).
 */
export async function clearSessionAfterCallbackTransitionFailure(
  signOut: () => Promise<{ readonly error: unknown }>,
  clearLocalSession: () => Promise<void>,
): Promise<void> {
  try {
    const result = await signOut();
    if (result.error === null || result.error === undefined) {
      return;
    }
  } catch {
    // Fall through to clearing the persisted session.
  }

  await clearLocalSession();
}
