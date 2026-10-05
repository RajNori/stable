import { principalSchema, type Principal } from "@stable/contracts";

/** Provider-neutral session identity. Extra role and token fields are ignored. */
export type SessionIdentity = {
  readonly id?: string;
  readonly userId?: string;
  readonly displayName?: string;
};

function presentIdentity(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return value;
}

/**
 * Maps a session double or provider user to a Principal.
 * Accepts `id` or `userId`. Drops role and token fields. Null session returns null.
 */
export function principalFromSession(
  session: SessionIdentity | null,
): Principal | null {
  if (session === null) {
    return null;
  }

  const userId = presentIdentity(session.userId) ?? presentIdentity(session.id);
  if (userId === undefined) {
    return null;
  }

  const displayName = session.displayName;
  const candidate =
    displayName !== undefined && displayName.length > 0
      ? { userId, displayName }
      : { userId };

  const parsed = principalSchema.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}
