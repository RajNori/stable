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
import { ENV } from "@stable/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clearUserGameDaySnapshots,
  secureGameDaySnapshotStore,
} from "./game-day-snapshot";
import {
  getMobileSessionStorage,
  getMobileSupabaseClient,
} from "./supabase-client";

export type MobileAuthStorage = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
};

type MobileAuthUser = {
  readonly id: string;
  readonly user_metadata?: unknown;
};

type MobileAuthSession = {
  readonly user: MobileAuthUser;
  readonly expires_at?: number;
};

export type MobileAuthClient = {
  auth: {
    getSession(): Promise<{
      data: { session: MobileAuthSession | null };
      error: unknown;
    }>;
    refreshSession(): Promise<{
      data: { session: MobileAuthSession | null };
      error: unknown;
    }>;
    signOut(options: { scope: LogoutScope }): Promise<{ error: unknown }>;
  };
};

export type MobileAuthSessionDependencies = {
  readonly client: MobileAuthClient;
  readonly storage: MobileAuthStorage;
  readonly storageKey: string;
  readonly now?: number;
};

export function mobileAuthStorageKey(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The Supabase URL is invalid.");
  }

  const project = url.hostname.split(".")[0];
  if (project === undefined || project.length === 0) {
    throw new Error("The Supabase URL is invalid.");
  }

  return `sb-${project}-auth-token`;
}

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

function principalFact(session: MobileAuthSession): StoredPrincipalFact {
  const accessExpiresAt =
    session.expires_at === undefined ? null : session.expires_at * 1000;
  const displayName = displayNameFromMetadata(session.user.user_metadata);
  if (displayName === undefined) {
    return { userId: session.user.id, accessExpiresAt };
  }

  return { userId: session.user.id, displayName, accessExpiresAt };
}

function readStoredSession(
  session: MobileAuthSession | null,
  error: unknown,
): PersistedSessionRead {
  if (error !== null && error !== undefined) {
    return { kind: "corrupt" };
  }

  if (session === null) {
    return { kind: "corrupt" };
  }

  return { kind: "principal", principal: principalFact(session) };
}

async function removeStoredSession(
  storage: MobileAuthStorage,
  storageKey: string,
): Promise<void> {
  await storage.removeItem(storageKey);
  await storage.removeItem(`${storageKey}-code-verifier`);
  await storage.removeItem(`${storageKey}-user`);
}

export function createMobileAuthSessionGateway(
  input: MobileAuthSessionDependencies,
): AuthSessionGateway {
  const gateway: AuthSessionGateway = {
    async readPersisted() {
      const raw = await input.storage.getItem(input.storageKey);
      if (raw === null || raw.trim().length === 0) {
        return { kind: "none" };
      }

      try {
        JSON.parse(raw);
      } catch {
        return { kind: "corrupt" };
      }

      const { data, error } = await input.client.auth.getSession();
      return readStoredSession(data.session, error);
    },
    async refresh() {
      const { data, error } = await input.client.auth.refreshSession();
      if (error !== null && error !== undefined) {
        const failure = providerFailureRead(error);
        if (failure.kind === "unavailable") {
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

      return { kind: "principal", principal: principalFact(data.session) };
    },
    async revoke(scope) {
      const { error } = await input.client.auth.signOut({ scope });
      if (error !== null && error !== undefined) {
        throw error;
      }
    },
    async clearLocal() {
      await removeStoredSession(input.storage, input.storageKey);
    },
  };

  return gateway;
}

export function mobileAuthSessionGatewayFromSupabase(
  client: SupabaseClient,
  storage: MobileAuthStorage,
  supabaseUrl: string,
): AuthSessionGateway {
  return createMobileAuthSessionGateway({
    client: {
      auth: {
        getSession: () => client.auth.getSession(),
        refreshSession: () => client.auth.refreshSession(),
        signOut: (options) => client.auth.signOut(options),
      },
    },
    storage,
    storageKey: mobileAuthStorageKey(supabaseUrl),
  });
}

export function createLiveMobileAuthSessionGateway(): AuthSessionGateway {
  const url = process.env[ENV.expoSupabaseUrl];
  if (url === undefined || url.length === 0) {
    throw new Error(`${ENV.expoSupabaseUrl} is required.`);
  }

  return mobileAuthSessionGatewayFromSupabase(
    getMobileSupabaseClient(),
    getMobileSessionStorage(),
    url,
  );
}

async function settle(
  gateway: AuthSessionGateway,
  now: number | undefined,
  run: (
    gateway: AuthSessionGateway,
    now?: number,
  ) => Promise<{ snapshot: AuthSessionSnapshot }>,
): Promise<AuthSessionSnapshot> {
  const decision =
    now === undefined ? await run(gateway) : await run(gateway, now);
  return decision.snapshot;
}

export async function restoreMobileAuthSession(
  input: MobileAuthSessionDependencies,
): Promise<AuthSessionSnapshot> {
  return settle(
    createMobileAuthSessionGateway(input),
    input.now,
    restoreAuthSession,
  );
}

export async function refreshMobileAuthSession(
  input: MobileAuthSessionDependencies,
): Promise<AuthSessionSnapshot> {
  return settle(
    createMobileAuthSessionGateway(input),
    input.now,
    refreshAuthSession,
  );
}

export async function restoreLiveMobileAuthSession(): Promise<AuthSessionSnapshot> {
  const decision = await restoreAuthSession(
    createLiveMobileAuthSessionGateway(),
  );
  return decision.snapshot;
}

export async function signOutLiveMobileAuthSession(): Promise<AuthSessionSnapshot> {
  const client = getMobileSupabaseClient();
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  const decision = await signOutAuthSession(
    createLiveMobileAuthSessionGateway(),
    "local",
  );
  if (userId !== undefined) {
    await clearUserGameDaySnapshots(secureGameDaySnapshotStore(), userId);
  }
  return decision.snapshot;
}

export async function signOutMobileAuthSession(
  input: MobileAuthSessionDependencies,
  scope: LogoutScope,
): Promise<AuthSessionSnapshot> {
  const decision = await signOutAuthSession(
    createMobileAuthSessionGateway(input),
    scope,
  );
  return decision.snapshot;
}
