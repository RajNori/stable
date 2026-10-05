// Local Supabase integration test for the club context reader.
// Not part of the default Vitest run. From this package:
//   pnpm exec vitest run src/infrastructure/supabase-club-context-reader.integration.test.ts
// Requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Use the publishable
// key from `supabase status`, not a secret key. Loading this file throws
// when either variable is missing.
import { CLUB_READ_CAPABILITY } from "@stable/contracts";
import type { Database } from "@stable/database-types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  createSupabaseClubContextReader,
  getCurrentClubContext,
} from "../index.js";

const LOCAL_PASSWORD = "local-dev-password";
const MEMBER_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";

function readEnv(name: string): string | undefined {
  const runtime: unknown = globalThis;
  if (
    typeof runtime !== "object" ||
    runtime === null ||
    !("process" in runtime)
  ) {
    return undefined;
  }

  const processBinding: unknown = runtime.process;
  if (
    typeof processBinding !== "object" ||
    processBinding === null ||
    !("env" in processBinding)
  ) {
    return undefined;
  }

  const env: unknown = processBinding.env;
  if (typeof env !== "object" || env === null || !(name in env)) {
    return undefined;
  }

  const record = env as Record<string, unknown>;
  const value = record[name];
  return typeof value === "string" ? value : undefined;
}

function requiredEnv(
  name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY",
): string {
  const value = readEnv(name);
  if (value === undefined || value.length === 0) {
    throw new Error(
      "Club context integration test requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return value;
}

const supabaseUrl = requiredEnv("SUPABASE_URL");
const publishableKey = requiredEnv("SUPABASE_PUBLISHABLE_KEY");

if (publishableKey.startsWith("sb_secret_")) {
  throw new Error(
    "Club context integration test refuses a secret key. Set SUPABASE_PUBLISHABLE_KEY to the publishable key.",
  );
}

async function readClubContext(email: string) {
  const client: SupabaseClient<Database> = createClient<Database>(
    supabaseUrl,
    publishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const signedIn = await client.auth.signInWithPassword({
    email,
    password: LOCAL_PASSWORD,
  });
  if (signedIn.error !== null || signedIn.data.user === null) {
    throw new Error(`Local sign-in failed for ${email}.`);
  }

  try {
    return await getCurrentClubContext({
      principal: { userId: signedIn.data.user.id },
      reader: createSupabaseClubContextReader(client),
    });
  } finally {
    try {
      await client.auth.signOut();
    } catch {
      // The session is in memory only when persistSession is false.
    }
  }
}

describe("supabase club context reader (local)", () => {
  it("returns mentone-mustangs and club.read for the local member", async () => {
    const context = await readClubContext(MEMBER_EMAIL);

    if (context.club === null) {
      throw new Error("Expected the member to have a club.");
    }

    expect(context.club.slug).toBe("mentone-mustangs");
    expect(context.capabilities).toContain(CLUB_READ_CAPABILITY);
  });

  it("returns no club for the local outsider", async () => {
    const context = await readClubContext(OUTSIDER_EMAIL);

    expect(context.club).toBeNull();
  });
});
