import {
  withPendingPushCleanupTransaction,
  type PendingPushCleanupStore,
} from "./pending-push-cleanup";

export type PreviousPushSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
};

/**
 * Revoke the previous endpoint after a callback exchange succeeds but local
 * session commit/admission fails. The persistent marker fences future push
 * registration until removal is confirmed.
 */
export async function tryRemoveCallbackPushRegistrationOrRetainFence(input: {
  readonly store: PendingPushCleanupStore;
  readonly previous: PreviousPushSession;
  readonly removeRegistration: (
    userId: string,
    accessToken: string,
    refreshToken: string,
  ) => Promise<void | boolean>;
}): Promise<boolean> {
  return withPendingPushCleanupTransaction(
    input.store,
    async ({ mark, clear }) => {
      await mark(input.previous.userId);
      try {
        const removed = await input.removeRegistration(
          input.previous.userId,
          input.previous.accessToken,
          input.previous.refreshToken,
        );
        if (removed !== false) {
          await clear(input.previous.userId);
          return true;
        }
      } catch {
        // Keep the account fenced while endpoint revocation is unresolved.
      }
      return false;
    },
  );
}

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
  return withPendingPushCleanupTransaction(input.store, async (transaction) => {
    const pendingUsers = await transaction.readUsers();
    if (!pendingUsers.includes(input.userId)) return false;

    const removed = await input.removeRegistration(
      input.userId,
      input.accessToken,
      input.refreshToken,
    );
    if (removed === false) {
      throw new Error("The previous account push endpoint is unresolved.");
    }
    await transaction.clear(input.userId);
    return true;
  });
}

export async function removePreviousPushAfterSuccessfulAccountSwitch(
  store: PendingPushCleanupStore,
  previous: PreviousPushSession | null,
  nextUserId: string,
  removeRegistration: (
    userId: string,
    accessToken: string,
    refreshToken: string,
  ) => Promise<void | boolean>,
  registrationAlreadyCleaned = false,
): Promise<boolean> {
  return withPendingPushCleanupTransaction(store, async (transaction) => {
    if (
      previous === null ||
      previous.userId === nextUserId ||
      registrationAlreadyCleaned
    ) {
      return true;
    }
    await transaction.mark(previous.userId);
    try {
      const removed = await removeRegistration(
        previous.userId,
        previous.accessToken,
        previous.refreshToken,
      );
      if (removed !== false) await transaction.clear(previous.userId);
      return removed !== false;
    } catch {
      return false;
    }
  });
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
