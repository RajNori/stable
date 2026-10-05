import {
  ApplicationError,
  type ClubStructureSnapshot,
} from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";
import {
  clubStructureMessages,
  createSupabaseClubStructureGateway,
} from "@stable/club-structure";

import { createSeasonAndTeamAction } from "./actions";
import { ClubAdminShell } from "../../components/club-admin-shell";
import { ClubStructurePanel } from "../../components/club-structure-panel";
import { loadLiveClubContext } from "../../lib/load-live-club-context";
import { principalFromSupabase } from "../../lib/principal";
import { createRuntimeClubContextReader } from "../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

const EMPTY_SNAPSHOT: ClubStructureSnapshot = {
  seasons: [],
  competitions: [],
  teams: [],
  venues: [],
};

type ClubStructurePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClubStructurePage({
  searchParams,
}: ClubStructurePageProps) {
  const params = await searchParams;
  const error = allowedStructureError(params["error"]);
  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return <ClubAdminShell presentation={presentation} />;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const principal = await principalFromSupabase(supabase);
    const reader = await createRuntimeClubContextReader(supabase);
    const context = await getCurrentClubContext({ principal, reader });
    if (context.club === null) {
      return <ClubAdminShell presentation={presentation} />;
    }

    const snapshot = await createSupabaseClubStructureGateway(supabase).list(
      context.club.id,
    );
    return (
      <ClubAdminShell presentation={presentation}>
        <ClubStructurePanel
          clubId={context.club.id}
          snapshot={snapshot}
          action={createSeasonAndTeamAction}
          error={error}
        />
      </ClubAdminShell>
    );
  } catch (caught: unknown) {
    const message =
      caught instanceof ApplicationError
        ? caught.message
        : clubStructureMessages.readFailed;
    return (
      <ClubAdminShell presentation={presentation}>
        <ClubStructurePanel
          clubId={null}
          snapshot={EMPTY_SNAPSHOT}
          action={createSeasonAndTeamAction}
          error={message}
        />
      </ClubAdminShell>
    );
  }
}

function allowedStructureError(
  value: string | string[] | undefined,
): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined) {
    return undefined;
  }

  const allowed: readonly string[] = Object.values(clubStructureMessages);
  return allowed.includes(text) ? text : undefined;
}
