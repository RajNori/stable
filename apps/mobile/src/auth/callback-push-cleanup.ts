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
      let fenced = false;
      try {
        await mark(input.previous.userId);
        fenced = true;
      } catch {
        // Secure storage can fail independently of the remote endpoint. Do
        // not let that prevent the best-effort revocation attempt below.
      }

      try {
        const removed = await input.removeRegistration(
          input.previous.userId,
          input.previous.accessToken,
          input.previous.refreshToken,
        );
        if (removed !== false) {
          if (fenced) await clear(input.previous.userId);
          return true;
        }
      } catch {
        // Keep the account fenced while endpoint revocation is unresolved.
      }

      if (!fenced) {
        // The first marker write may have failed transiently. Retry after the
        // remote attempt so unresolved revocation still survives app restart
        // whenever SecureStore recovers. The caller keeps registration
        // suspended in memory if this retry also fails.
        try {
          await mark(input.previous.userId);
        } catch {
          // Return unresolved; never report cleanup complete without either
          // confirmed revocation or a persisted cleanup fence.
        }
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
 * Clear the callback session only after the prior push endpoint is confirmed
 * removed or its cleanup fence is persisted. If cleanup is unresolved, keep
 * the session in recovery so the callback cannot admit a different account.
 * Supabase signOut can resolve with an error object, so callers must clear the
 * persisted session themselves in that case (and when signOut throws).
 */
export async function clearSessionAfterCallbackTransitionFailure(
  signOut: () => Promise<{ readonly error: unknown }>,
  clearLocalSession: () => Promise<void>,
  isPushCleanupResolved: () => Promise<boolean> = async () => true,
): Promise<boolean> {
  if (!(await isPushCleanupResolved())) return false;

  try {
    const result = await signOut();
    if (result.error === null || result.error === undefined) {
      return true;
    }
  } catch {
    // Fall through to clearing the persisted session.
  }

  await clearLocalSession();
  return true;
}
