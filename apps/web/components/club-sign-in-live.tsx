"use client";

import type { AuthSessionSnapshot } from "@stable/contracts";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { ClubSignIn } from "./club-sign-in";

type ClubSignInLiveProps = {
  readonly session: AuthSessionSnapshot;
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly notice: string | null;
};

export function ClubSignInLive({
  session,
  supabaseUrl,
  publishableKey,
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
      async retry() {
        router.refresh();
      },
    }),
    [publishableKey, router, supabaseUrl],
  );

  return <ClubSignIn session={session} actions={actions} notice={notice} />;
}
