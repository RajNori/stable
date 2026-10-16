import { NextResponse } from "next/server";
import { AUTH_ERROR_MESSAGES } from "@stable/contracts";

import { loadWebBootEnv } from "../../../lib/boot-env.server";
import { authQueryFlag } from "../../../lib/home-auth";
import {
  callbackUrlFromCode,
  rejectProviderCallback,
  resolveAuthCallback,
} from "../../../lib/resolve-auth-callback";
import { createSupabaseRedirectClient } from "../../../lib/supabase/server";
import { createWebOtpClient } from "../../../lib/web-otp-client";
import {
  RECOVERY_COOKIE_MAX_AGE_SECONDS,
  RECOVERY_PENDING_COOKIE,
  recoveryDeadline,
} from "../../../lib/password-recovery";

export async function GET(request: Request): Promise<NextResponse> {
  const boot = loadWebBootEnv();
  const appOrigin = boot.webOrigin ?? "http://127.0.0.1:3000";
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  if (providerError !== null && providerError.length > 0) {
    return redirectWithFlag(
      appOrigin,
      rejectProviderCallback(providerError).message,
    );
  }

  if (url.searchParams.get("type") === "recovery") {
    const code = url.searchParams.get("code");
    if (code === null || code.length === 0) {
      return redirectWithFlag(appOrigin, AUTH_ERROR_MESSAGES.VALIDATION_FAILED);
    }
    let redirectClient: Awaited<
      ReturnType<typeof createSupabaseRedirectClient>
    >;
    try {
      redirectClient = await createSupabaseRedirectClient();
      const { error } =
        await redirectClient.client.auth.exchangeCodeForSession(code);
      if (error !== null) {
        return redirectWithFlag(
          appOrigin,
          AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
        );
      }
    } catch {
      return redirectWithFlag(appOrigin, AUTH_ERROR_MESSAGES.VALIDATION_FAILED);
    }
    const response = NextResponse.redirect(new URL("/auth/recover", appOrigin));
    response.cookies.set(RECOVERY_PENDING_COOKIE, recoveryDeadline(), {
      httpOnly: true,
      secure: appOrigin.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
    });
    return redirectClient.applyCookies(response);
  }

  const next = url.searchParams.get("next");
  const { client, applyCookies } = await createSupabaseRedirectClient();
  const resolved = await resolveAuthCallback(createWebOtpClient(client), {
    callbackUrl: callbackUrlFromCode(url.searchParams.get("code"), appOrigin),
    appEnv: boot.appEnv,
    webOrigin: appOrigin,
    ...(next === null ? {} : { returnTo: next }),
  });

  if (resolved.status === "redirect") {
    return applyCookies(NextResponse.redirect(new URL(resolved.to, appOrigin)));
  }

  return redirectWithFlag(appOrigin, resolved.message);
}

function redirectWithFlag(origin: string, message: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/?auth=${authQueryFlag(message)}`, origin),
  );
}
