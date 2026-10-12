import type { AuthSessionSnapshot } from "@stable/contracts";

export type PreviousPushSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
};

export function cleanupPushAfterSuccessfulCallback(
  previous: PreviousPushSession | null,
  removeRegistration: (
    userId: string,
    accessToken: string,
    refreshToken: string,
  ) => Promise<void>,
): (next: AuthSessionSnapshot) => Promise<void> {
  return async (next) => {
    if (
      previous !== null &&
      next.state === "authenticated" &&
      next.principal.userId !== previous.userId
    ) {
      await removeRegistration(
        previous.userId,
        previous.accessToken,
        previous.refreshToken,
      );
    }
  };
}

/**
 * A failed push-registration cleanup must leave no restorable local session.
 * Supabase signOut can resolve with an error object, so callers must clear the
 * persisted session themselves in that case (and when signOut throws).
 */
export async function clearSessionAfterPushCleanupFailure(
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
