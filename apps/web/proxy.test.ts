import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { RECOVERY_PENDING_COOKIE } from "./lib/password-recovery";
import { proxy } from "./proxy";

describe("recovery route gate", () => {
  it("leaves requests without a recovery marker unchanged", () => {
    const response = proxy(
      new NextRequest("https://stable.example/club-structure"),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects an active recovery session away from application routes", () => {
    const request = new NextRequest("https://stable.example/club-structure", {
      headers: {
        cookie: `${RECOVERY_PENDING_COOKIE}=${Date.now() + 60_000}`,
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://stable.example/auth/recover",
    );
  });

  it("clears expired recovery and Supabase session cookies", () => {
    const request = new NextRequest("https://stable.example/club-structure", {
      headers: {
        cookie: `${RECOVERY_PENDING_COOKIE}=1; sb-rporaeagbsfmgbmhyett-auth-token.0=stale`,
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://stable.example/?auth=recovery-expired",
    );
    expect(response.cookies.get(RECOVERY_PENDING_COOKIE)?.maxAge).toBe(0);
    expect(
      response.cookies.get("sb-rporaeagbsfmgbmhyett-auth-token.0")?.maxAge,
    ).toBe(0);
  });

  it("clears an active marker when its Supabase session is no longer valid", () => {
    const request = new NextRequest(
      "https://stable.example/?auth=recovery-expired",
      {
        headers: {
          cookie: `${RECOVERY_PENDING_COOKIE}=${Date.now() + 60_000}; sb-rporaeagbsfmgbmhyett-auth-token=stale`,
        },
      },
    );
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://stable.example/?auth=recovery-expired",
    );
    expect(response.cookies.get(RECOVERY_PENDING_COOKIE)?.maxAge).toBe(0);
    expect(
      response.cookies.get("sb-rporaeagbsfmgbmhyett-auth-token")?.maxAge,
    ).toBe(0);
  });
});
