import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readPublicSupabaseConfig,
  readPublicWebObservabilityConfig,
} from "./public-supabase-env";

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

  it("reads only configured public observability values for browser startup", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.invalid");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://rporaeagbsfmgbmhyett.supabase.co",
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.invalid/1");
    vi.stubEnv("SENTRY_DSN", "https://private@example.invalid/2");

    expect(readPublicWebObservabilityConfig()).toEqual({
      appEnv: "staging",
      sentryDsn: "https://public@example.invalid/1",
    });
  });
});
