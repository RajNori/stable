import { afterEach, describe, expect, it, vi } from "vitest";

import { readPublicSupabaseConfig } from "./public-supabase-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readPublicSupabaseConfig", () => {
  it("reads statically referenced staging variables for the Supabase client", () => {
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

    expect(readPublicSupabaseConfig()).toEqual({
      url: "https://rporaeagbsfmgbmhyett.supabase.co",
      publishableKey: "publishable-test",
    });
  });
});
