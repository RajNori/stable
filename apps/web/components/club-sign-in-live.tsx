"use client";

import type { AuthSessionSnapshot } from "@stable/contracts";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { recoveryRedirectTo } from "../lib/password-recovery";
import { ClubSignIn } from "./club-sign-in";

type ClubSignInLiveProps = {
  readonly session: AuthSessionSnapshot;
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly webOrigin: string;
  readonly notice: string | null;
};

export function ClubSignInLive({
  session,
  supabaseUrl,
  publishableKey,
  webOrigin,
  notice,
}: ClubSignInLiveProps) {
  const router = useRouter();
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
    }),
    [publishableKey, router, supabaseUrl, webOrigin],
  );

  return <ClubSignIn session={session} actions={actions} notice={notice} />;
}
