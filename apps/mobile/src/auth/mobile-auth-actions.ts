import {
  createSupabaseOtpAuthClient,
  authCodeFromCallback,
  mapAuthError,
  requestEmailSignIn,
  requestPhoneOtp,
  verifyPhoneOtp,
  principalFromSession,
  type OtpAuthClient,
} from "@stable/auth";
import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  type AppEnv,
  type AuthSessionSnapshot,
} from "@stable/contracts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mobileAuthStorageKey } from "../auth-session";
import type { ChunkedSessionStorage } from "../secure-session-store";

const MOBILE_CALLBACK = "stable://auth/callback";

export type CallbackSession = {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly user: {
    readonly id: string;
    readonly user_metadata?: unknown;
  };
};

export type DeferredCallbackAuth = {
  exchange(code: string): Promise<CallbackSession>;
  commit(session: CallbackSession): Promise<void>;
};

/** The callback client may read the verifier, but only deletes that one key. */
export function createCallbackVerifierStorage(
  storage: ChunkedSessionStorage,
  verifierKey: string,
) {
  return {
    getItem: (key: string) =>
      key === verifierKey ? storage.getItem(key) : Promise.resolve(null),
    setItem: async (...args: string[]) => {
      void args;
    },
    removeItem: (key: string) =>
      key === verifierKey ? storage.removeItem(key) : Promise.resolve(),
  };
}

/**
 * Exchange OAuth codes without replacing the active persisted session. The
 * temporary client can read and consume only Supabase's PKCE verifier; its
 * storage adapter discards every session write. The caller decides when to
 * commit the accepted session after completing account-transition cleanup.
 */
export function createDeferredCallbackAuth(
  supabase: SupabaseClient,
  storage: ChunkedSessionStorage,
  publicConfig: { readonly url: string; readonly publishableKey: string },
): DeferredCallbackAuth {
  const storageKey = mobileAuthStorageKey(publicConfig.url);
  const verifierKey = `${storageKey}-code-verifier`;

  return {
    async exchange(code) {
      const callbackClient = createClient(
        publicConfig.url,
        publicConfig.publishableKey,
        {
          auth: {
            storage: createCallbackVerifierStorage(storage, verifierKey),
            autoRefreshToken: false,
            // Supabase Auth uses custom storage only when persistence is on.
            // This adapter persists only verifier removal and discards tokens.
            persistSession: true,
            detectSessionInUrl: false,
          },
        },
      );
      const { data, error } =
        await callbackClient.auth.exchangeCodeForSession(code);
      if (error !== null) throw mapAuthError(error);
      if (data.session === null || data.session.user === null) {
        throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
      }
      return data.session;
    },
    async commit(session) {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error !== null) throw mapAuthError(error);
    },
  };
}

export function createMobileOtpClient(supabase: SupabaseClient): OtpAuthClient {
  return createSupabaseOtpAuthClient({
    async signInWithOtp(credentials) {
      if ("phone" in credentials) {
        const result = await supabase.auth.signInWithOtp({
          phone: credentials.phone,
          options: credentials.options,
        });
        return { error: result.error };
      }
      const result = await supabase.auth.signInWithOtp({
        email: credentials.email,
        options: credentials.options,
      });
      return { error: result.error };
    },
    async verifyOtp(params) {
      if ("phone" in params) {
        return supabase.auth.verifyOtp({
          phone: params.phone,
          token: params.token,
          type: "sms",
        });
      }
      return supabase.auth.verifyOtp({
        email: params.email,
        token: params.token,
        type: "email",
      });
    },
    exchangeCodeForSession(code: string) {
      return supabase.auth.exchangeCodeForSession(code);
    },
  });
}

export function createMobileAuthActions(
  client: OtpAuthClient,
  appEnv: AppEnv,
  callbackAuth: DeferredCallbackAuth,
) {
  return {
    requestPhone(phone: string) {
      return requestPhoneOtp(client, { phone }).then(() => undefined);
    },
    verifyPhone(phone: string, token: string): Promise<AuthSessionSnapshot> {
      return verifyPhoneOtp(client, { phone, token });
    },
    requestEmail(email: string) {
      return requestEmailSignIn(client, {
        email,
        redirectTo: MOBILE_CALLBACK,
        appEnv,
      }).then(() => undefined);
    },
    validateCallback(callbackUrl: string): void {
      authCodeFromCallback(callbackUrl, appEnv);
    },
    async completeCallback(
      callbackUrl: string,
      beforeCommit?: (next: AuthSessionSnapshot) => Promise<void>,
    ): Promise<AuthSessionSnapshot> {
      const code = authCodeFromCallback(callbackUrl, appEnv);
      const session = await callbackAuth.exchange(code);
      const displayName =
        typeof session.user.user_metadata === "object" &&
        session.user.user_metadata !== null &&
        "display_name" in session.user.user_metadata &&
        typeof session.user.user_metadata.display_name === "string"
          ? session.user.user_metadata.display_name
          : undefined;
      const principal = principalFromSession({
        id: session.user.id,
        ...(displayName === undefined ? {} : { displayName }),
      });
      if (principal === null) {
        throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
      }
      const next: AuthSessionSnapshot = { state: "authenticated", principal };
      await beforeCommit?.(next);
      await callbackAuth.commit(session);
      return next;
    },
  };
}
