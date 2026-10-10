"use client";

import {
  requestEmailSignIn,
  requestPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
  type OtpAuthClient,
} from "@stable/auth";
import type { AppEnv, AuthSessionSnapshot } from "@stable/contracts";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { createWebOtpClient } from "../lib/web-otp-client";
import { ClubSignIn } from "./club-sign-in";

function browserOtpClient(
  supabaseUrl: string,
  publishableKey: string,
): OtpAuthClient {
  return createWebOtpClient(
    createSupabaseBrowserClient({ url: supabaseUrl, publishableKey }),
  );
}

type ClubSignInLiveProps = {
  readonly session: AuthSessionSnapshot;
  readonly appEnv: AppEnv;
  readonly webOrigin: string;
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly notice: string | null;
};

export function ClubSignInLive({
  session,
  appEnv,
  webOrigin,
  supabaseUrl,
  publishableKey,
  notice,
}: ClubSignInLiveProps) {
  const router = useRouter();
  const actions = useMemo(
    () => ({
      requestPhone(phone: string) {
        return requestPhoneOtp(browserOtpClient(supabaseUrl, publishableKey), {
          phone,
        }).then(() => undefined);
      },
      async verifyPhone(phone: string, token: string) {
        await verifyPhoneOtp(browserOtpClient(supabaseUrl, publishableKey), {
          phone,
          token,
        });
        router.refresh();
      },
      requestEmail(email: string) {
        return requestEmailSignIn(
          browserOtpClient(supabaseUrl, publishableKey),
          {
            email,
            redirectTo: `${webOrigin}/auth/callback`,
            appEnv,
            webOrigin,
          },
        ).then(() => undefined);
      },
      async verifyEmail(email: string, token: string) {
        await verifyEmailOtp(browserOtpClient(supabaseUrl, publishableKey), {
          email,
          token,
        });
        router.refresh();
      },
      async retry() {
        router.refresh();
      },
    }),
    [appEnv, publishableKey, router, supabaseUrl, webOrigin],
  );

  return <ClubSignIn session={session} actions={actions} notice={notice} />;
}
