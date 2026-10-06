import { restoreAuthSession } from "@stable/auth";

import { ClubAdminShell } from "../components/club-admin-shell";
import { ClubSignInLive } from "../components/club-sign-in-live";
import { SignOutButton } from "../components/sign-out-button";
import { loadWebBootEnv } from "../lib/boot-env.server";
import {
  contextFixtureFromQuery,
  fixtureClubContextInput,
} from "../lib/fixtures";
import { callbackNotice, shouldLoadClubContext } from "../lib/home-auth";
import { loadClubContext } from "../lib/load-club-context";
import { loadLiveClubContext } from "../lib/load-live-club-context";
import { webAuthSessionGatewayFromSupabase } from "../lib/auth-session";
import { createSupabaseServerClient } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const fixtureName = contextFixtureFromQuery(params["fixture"]);

  if (fixtureName === "loading") {
    return <ClubAdminShell presentation={{ status: "loading" }} />;
  }

  if (fixtureName === null) {
    const boot = loadWebBootEnv();
    const client = await createSupabaseServerClient();
    const decision = await restoreAuthSession(
      webAuthSessionGatewayFromSupabase(client),
    );
    if (!shouldLoadClubContext(decision.snapshot)) {
      return (
        <ClubSignInLive
          session={decision.snapshot}
          appEnv={boot.appEnv}
          supabaseUrl={boot.supabaseUrl}
          publishableKey={boot.supabasePublishableKey}
          notice={callbackNotice(params)}
        />
      );
    }

    const presentation = await loadLiveClubContext();
    return (
      <ClubAdminShell
        presentation={presentation}
        accessory={
          <SignOutButton
            supabaseUrl={boot.supabaseUrl}
            publishableKey={boot.supabasePublishableKey}
          />
        }
      />
    );
  }

  const presentation = await loadClubContext(
    fixtureClubContextInput(fixtureName),
  );
  return <ClubAdminShell presentation={presentation} />;
}
