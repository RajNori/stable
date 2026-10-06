import {
  completeEmailCallback,
  createSupabaseOtpAuthClient,
  requestEmailSignIn,
  requestPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
  type OtpAuthClient,
} from "@stable/auth";
import type { AppEnv, AuthSessionSnapshot } from "@stable/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

const MOBILE_CALLBACK = "stable://auth/callback";

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

export function createMobileAuthActions(client: OtpAuthClient, appEnv: AppEnv) {
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
    verifyEmail(email: string, token: string): Promise<AuthSessionSnapshot> {
      return verifyEmailOtp(client, { email, token });
    },
    async completeCallback(callbackUrl: string): Promise<AuthSessionSnapshot> {
      const completed = await completeEmailCallback(client, {
        callbackUrl,
        appEnv,
        returnTo: "/",
      });
      return completed.snapshot;
    },
  };
}
