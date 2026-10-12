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
