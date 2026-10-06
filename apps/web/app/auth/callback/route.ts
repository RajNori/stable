import { NextResponse } from "next/server";

import { loadWebBootEnv } from "../../../lib/boot-env.server";
import { authQueryFlag } from "../../../lib/home-auth";
import {
  callbackUrlFromCode,
  rejectProviderCallback,
  resolveAuthCallback,
} from "../../../lib/resolve-auth-callback";
import { createSupabaseRedirectClient } from "../../../lib/supabase/server";
import { createWebOtpClient } from "../../../lib/web-otp-client";

const LOCAL_APP_ORIGIN = "http://127.0.0.1:3000";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  if (providerError !== null && providerError.length > 0) {
    return redirectWithFlag(
      LOCAL_APP_ORIGIN,
      rejectProviderCallback(providerError).message,
    );
  }

  const boot = loadWebBootEnv();
  const next = url.searchParams.get("next");
  const { client, applyCookies } = await createSupabaseRedirectClient();
  const resolved = await resolveAuthCallback(createWebOtpClient(client), {
    callbackUrl: callbackUrlFromCode(url.searchParams.get("code")),
    appEnv: boot.appEnv,
    ...(next === null ? {} : { returnTo: next }),
  });

  if (resolved.status === "redirect") {
    return applyCookies(
      NextResponse.redirect(new URL(resolved.to, LOCAL_APP_ORIGIN)),
    );
  }

  return redirectWithFlag(LOCAL_APP_ORIGIN, resolved.message);
}

function redirectWithFlag(origin: string, message: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/?auth=${authQueryFlag(message)}`, origin),
  );
}
