import type { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("../../../lib/boot-env.server", () => ({
  loadWebBootEnv: () => ({
    appEnv: "staging",
    webOrigin: "https://staging.stable.example",
  }),
}));

vi.mock("../../../lib/supabase/server", () => ({
  createSupabaseRedirectClient: async () => ({
    client: { auth: { exchangeCodeForSession } },
    applyCookies: (response: NextResponse) => response,
  }),
}));

describe("password recovery callback route", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges the code and redirects only to the configured recovery route", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "https://attacker.example/auth/callback?type=recovery&code=one-time-code",
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
    expect(response.headers.get("location")).toBe(
      "https://staging.stable.example/auth/recover",
    );
    expect(response.cookies.get("stable_recovery_pending")?.httpOnly).toBe(
      true,
    );
    expect(response.cookies.get("stable_recovery_pending")?.secure).toBe(true);
    expect(response.cookies.get("stable_recovery_pending")?.sameSite).toBe(
      "lax",
    );
  });

  it("rejects missing or invalid recovery codes without starting a session", async () => {
    const { GET } = await import("./route");
    const missing = await GET(
      new Request("https://staging.stable.example/auth/callback?type=recovery"),
    );
    expect(missing.headers.get("location")).toBe(
      "https://staging.stable.example/?auth=validation",
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();

    exchangeCodeForSession.mockResolvedValueOnce({
      error: new Error("expired"),
    });
    const invalid = await GET(
      new Request(
        "https://staging.stable.example/auth/callback?type=recovery&code=expired",
      ),
    );
    expect(invalid.headers.get("location")).toBe(
      "https://staging.stable.example/?auth=validation",
    );
    expect(invalid.cookies.get("stable_recovery_pending")).toBeUndefined();
  });
});
