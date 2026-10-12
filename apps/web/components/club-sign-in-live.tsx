"use client";

import type {
  AuthSessionSnapshot,
  OAuthSignInProvider,
} from "@stable/contracts";
import {
  createSupabaseOAuthSignInGateway,
  startOAuthBrowserSignIn,
} from "@stable/auth";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { frozenAuthProviderSettings } from "../lib/provider-visibility";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { recoveryRedirectTo } from "../lib/password-recovery";
import { ClubSignIn } from "./club-sign-in";

type ClubSignInLiveProps = {
  readonly session: AuthSessionSnapshot;
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly webOrigin: string;
  readonly appEnv: "local" | "staging" | "production";
  readonly notice: string | null;
};

export function ClubSignInLive({
  session,
  supabaseUrl,
  publishableKey,
  webOrigin,
  appEnv,
  notice,
}: ClubSignInLiveProps) {
  const router = useRouter();
  const providerSettings = useMemo(() => frozenAuthProviderSettings(), []);
  const actions = useMemo(
    () => ({
      async signInPassword(email: string, password: string) {
        const supabase = createSupabaseBrowserClient({
          url: supabaseUrl,
          publishableKey,
        });
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (result.error !== null) {
          throw result.error;
        }
        router.refresh();
      },
      async requestPasswordRecovery(email: string) {
        // Supabase intentionally returns the same successful response whether
        // or not an account exists. Keep provider details out of the UI too.
        try {
          const supabase = createSupabaseBrowserClient({
            url: supabaseUrl,
            publishableKey,
          });
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: recoveryRedirectTo(webOrigin),
          });
        } catch {
          // The confirmation remains neutral so the form cannot enumerate
          // accounts through provider errors.
        }
      },
      async retry() {
        router.refresh();
      },
      async startOAuth(provider: OAuthSignInProvider) {
        if (provider !== "google" && provider !== "facebook") {
          throw new Error("The sign-in provider is unavailable.");
        }
        const supabase = createSupabaseBrowserClient({
          url: supabaseUrl,
          publishableKey,
        });
        const gateway = createSupabaseOAuthSignInGateway(supabase.auth);
        const navigation = await startOAuthBrowserSignIn(gateway, {
          provider,
          redirectTo: `${webOrigin}/auth/callback`,
          appEnv,
          authOrigin: new URL(supabaseUrl).origin,
          webOrigin,
          settings: providerSettings[provider],
        });
        window.location.assign(navigation.authorizationUrl);
      },
    }),
    [appEnv, providerSettings, publishableKey, router, supabaseUrl, webOrigin],
  );

  return (
    <ClubSignIn
      session={session}
      actions={actions}
      providerSettings={providerSettings}
      onProvider={(provider) => actions.startOAuth(provider)}
      notice={notice}
    />
  );
}
