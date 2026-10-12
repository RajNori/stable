export type PreviousPushSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
};

export async function removePreviousPushAfterSuccessfulAccountSwitch(
  previous: PreviousPushSession | null,
  nextUserId: string,
  removeRegistration: (
    userId: string,
    accessToken: string,
    refreshToken: string,
  ) => Promise<void>,
): Promise<void> {
  if (previous === null || previous.userId === nextUserId) return;
  await removeRegistration(
    previous.userId,
    previous.accessToken,
    previous.refreshToken,
  );
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
