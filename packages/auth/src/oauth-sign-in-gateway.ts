import type { OAuthSignInAdult, OAuthSignInGateway } from "./oauth-sign-in.js";

export type OAuthSignInApi = {
  signInWithOAuth(credentials: {
    readonly provider: "google" | "apple";
    readonly options: {
      readonly redirectTo: string;
      readonly skipBrowserRedirect: true;
    };
  }): Promise<{
    data: { url: string | null };
    error: unknown;
  }>;
  exchangeCodeForSession(code: string): Promise<{
    data: {
      user: { readonly id: string; readonly user_metadata?: unknown } | null;
    };
    error: unknown;
  }>;
  signInWithIdToken(credentials: {
    readonly provider: "google" | "apple";
    readonly token: string;
    readonly nonce: string;
  }): Promise<{
    data: {
      user: { readonly id: string; readonly user_metadata?: unknown } | null;
    };
    error: unknown;
  }>;
};

export function createSupabaseOAuthSignInGateway(
  api: OAuthSignInApi,
): OAuthSignInGateway {
  return {
    async startBrowserSignIn(input) {
      const started = await api.signInWithOAuth({
        provider: input.provider,
        options: {
          redirectTo: input.redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (started.error !== null && started.error !== undefined) {
        throw started.error;
      }
      if (started.data.url === null || started.data.url.length === 0) {
        throw { code: "provider_error" };
      }
      return { authorizationUrl: started.data.url };
    },
    async exchangeSignInCode(input) {
      const exchanged = await api.exchangeCodeForSession(input.code);
      if (exchanged.error !== null && exchanged.error !== undefined) {
        throw exchanged.error;
      }
      return adultFrom(exchanged.data.user);
    },
    async signInWithIdToken(input) {
      const signedIn = await api.signInWithIdToken({
        provider: input.provider,
        token: input.idToken,
        nonce: input.nonce,
      });
      if (signedIn.error !== null && signedIn.error !== undefined) {
        throw signedIn.error;
      }
      return adultFrom(signedIn.data.user);
    },
  };
}

function adultFrom(
  user: { readonly id: string; readonly user_metadata?: unknown } | null,
): OAuthSignInAdult | null {
  if (user === null) {
    return null;
  }
  const displayName = displayNameFromMetadata(user.user_metadata);
  if (displayName === undefined) {
    return { id: user.id };
  }
  return { id: user.id, displayName };
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
