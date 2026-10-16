import { NextResponse, type NextRequest } from "next/server";

import {
  RECOVERY_PENDING_COOKIE,
  isRecoveryRoute,
  recoveryMarkerState,
} from "./lib/password-recovery";

export function proxy(request: NextRequest): NextResponse {
  const marker = request.cookies.get(RECOVERY_PENDING_COOKIE)?.value;
  const state = recoveryMarkerState(marker);
  if (state === "none") {
    return NextResponse.next();
  }

  if (state === "active") {
    if (isRecoveryRoute(request.nextUrl.pathname)) {
      return NextResponse.next();
    }
    if (
      request.nextUrl.pathname === "/" &&
      request.nextUrl.searchParams.get("auth") === "recovery-expired"
    ) {
      return clearRecoverySession(request);
    }
    return NextResponse.redirect(new URL("/auth/recover", request.url));
  }

  return clearRecoverySession(request);
}

function clearRecoverySession(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(
    new URL("/?auth=recovery-expired", request.url),
  );
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  response.cookies.set(RECOVERY_PENDING_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
