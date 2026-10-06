import {
  providerFailureRead,
  refreshAuthSession,
  restoreAuthSession,
  signOutAuthSession,
  type AuthSessionGateway,
  type PersistedSessionRead,
  type StoredPrincipalFact,
} from "@stable/auth";
import type { AuthSessionSnapshot, LogoutScope } from "@stable/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

type WebAuthUser = {
  readonly id: string;
  readonly user_metadata?: unknown;
};

type WebAuthSession = {
  readonly user: WebAuthUser;
  readonly expires_at?: number;
};

export type WebAuthClient = {
  auth: {
    getUser(): Promise<{
      data: { user: WebAuthUser | null };
      error: unknown;
    }>;
    refreshSession(): Promise<{
      data: { session: WebAuthSession | null };
      error: unknown;
    }>;
    signOut(options: { scope: LogoutScope }): Promise<{ error: unknown }>;
  };
};

function displayNameFromMetadata(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }

  if (!("display_name" in metadata)) {
    return undefined;
  }

  const value: unknown = metadata.display_name;
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

function principalFromUser(
  user: WebAuthUser,
  expiresAt: number | null,
): StoredPrincipalFact {
  const displayName = displayNameFromMetadata(user.user_metadata);
  if (displayName === undefined) {
    return { userId: user.id, accessExpiresAt: expiresAt };
  }

  return { userId: user.id, displayName, accessExpiresAt: expiresAt };
}

function failureRead(error: unknown): PersistedSessionRead {
  if (error instanceof SyntaxError) {
    return { kind: "corrupt" };
  }

  return providerFailureRead(error);
}

export function createWebAuthSessionGateway(
  client: WebAuthClient,
): AuthSessionGateway {
  const gateway: AuthSessionGateway = {
    async readPersisted() {
      try {
        const { data, error } = await client.auth.getUser();
        if (error !== null && error !== undefined) {
          return failureRead(error);
        }

        if (data.user === null) {
          return { kind: "none" };
        }

        return {
          kind: "principal",
          principal: principalFromUser(data.user, null),
        };
      } catch (error) {
        return failureRead(error);
      }
    },
    async refresh() {
      try {
        const { data, error } = await client.auth.refreshSession();
        if (error !== null && error !== undefined) {
          const failure = failureRead(error);
          if (failure.kind === "unavailable" || failure.kind === "corrupt") {
            return failure;
          }

          const follow = await gateway.readPersisted();
          if (follow.kind === "principal" || follow.kind === "unavailable") {
            return follow;
          }

          return failure;
        }

        if (data.session === null) {
          return { kind: "expired" };
        }

        const expiresAt =
          data.session.expires_at === undefined
            ? null
            : data.session.expires_at * 1000;
        return {
          kind: "principal",
          principal: principalFromUser(data.session.user, expiresAt),
        };
      } catch (error) {
        return failureRead(error);
      }
    },
    async revoke(scope) {
      const { error } = await client.auth.signOut({ scope });
      if (error !== null && error !== undefined) {
        throw error;
      }
    },
    async clearLocal() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error !== null && error !== undefined) {
        throw error;
      }
    },
  };

  return gateway;
}

export function webAuthSessionGatewayFromSupabase(
  client: SupabaseClient,
): AuthSessionGateway {
  return createWebAuthSessionGateway({
    auth: {
      async getUser() {
        const { data, error } = await client.auth.getUser();
        if (data.user === null) {
          return { data: { user: null }, error };
        }

        return {
          data: {
            user: {
              id: data.user.id,
              user_metadata: data.user.user_metadata,
            },
          },
          error,
        };
      },
      async refreshSession() {
        const { data, error } = await client.auth.refreshSession();
        if (data.session === null) {
          return { data: { session: null }, error };
        }

        const session: WebAuthSession = {
          user: {
            id: data.session.user.id,
            user_metadata: data.session.user.user_metadata,
          },
        };
        if (data.session.expires_at === undefined) {
          return { data: { session }, error };
        }

        return {
          data: {
            session: { ...session, expires_at: data.session.expires_at },
          },
          error,
        };
      },
      signOut(options) {
        return client.auth.signOut(options);
      },
    },
  });
}

async function settle(
  client: WebAuthClient,
  now: number | undefined,
  run: (
    gateway: AuthSessionGateway,
    now?: number,
  ) => Promise<{ snapshot: AuthSessionSnapshot }>,
): Promise<AuthSessionSnapshot> {
  const gateway = createWebAuthSessionGateway(client);
  const decision =
    now === undefined ? await run(gateway) : await run(gateway, now);
  return decision.snapshot;
}

export async function restoreWebAuthSession(
  client: WebAuthClient,
  now?: number,
): Promise<AuthSessionSnapshot> {
  return settle(client, now, restoreAuthSession);
}

export async function refreshWebAuthSession(
  client: WebAuthClient,
  now?: number,
): Promise<AuthSessionSnapshot> {
  return settle(client, now, refreshAuthSession);
}

export async function signOutWebAuthSession(
  client: WebAuthClient,
  scope: LogoutScope,
): Promise<AuthSessionSnapshot> {
  const decision = await signOutAuthSession(
    createWebAuthSessionGateway(client),
    scope,
  );
  return decision.snapshot;
}
