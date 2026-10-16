import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "@stable/contracts";

import { loadWebBootEnv } from "./boot-env.server";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadWebBootEnv", () => {
  it("reads the exact statically referenced staging variables", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://web-git-milestone-5b-pilot-db8353-noriprototype-5577s-projects.vercel.app",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://rporaeagbsfmgbmhyett.supabase.co",
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-only-test-secret");

    const config = loadWebBootEnv();

    expect(config).toEqual({
      appEnv: "staging",
      webOrigin:
        "https://web-git-milestone-5b-pilot-db8353-noriprototype-5577s-projects.vercel.app",
      supabaseUrl: "https://rporaeagbsfmgbmhyett.supabase.co",
      supabasePublishableKey: "publishable-test",
    });
    expect(JSON.stringify(config)).not.toContain("server-only-test-secret");
    expect(ENV.nextSiteUrl).toBe("NEXT_PUBLIC_SITE_URL");
  });

  it("keeps the remote origin requirement fail-closed", () => {
    expect(() =>
      loadWebBootEnv({
        [ENV.nextAppEnv]: "staging",
        [ENV.nextSupabaseUrl]: "https://rporaeagbsfmgbmhyett.supabase.co",
        [ENV.nextSupabasePublishableKey]: "publishable-test",
      }),
    ).toThrow("NEXT_PUBLIC_SITE_URL is required outside local mode.");
  });
});
