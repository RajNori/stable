import type { ClubContextPresentation } from "./club-context-presentation";
import { getCurrentClubContext } from "@stable/current-club-context";
import { createSupabaseClubStructureGateway } from "@stable/club-structure";
import type { RosterFacts } from "@stable/roster";

import { loadLiveClubContext } from "./load-live-club-context";
import { principalFromSupabase } from "./principal";
import { createRuntimeClubContextReader } from "./runtime-club-context-reader";
import { createSupabaseServerClient } from "./supabase/server";

export type LoadedRoster = {
  presentation: ClubContextPresentation;
  facts: RosterFacts | null;
  teamName: string | null;
};

export async function loadRosterRequest(teamId: string): Promise<LoadedRoster> {
  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return { presentation, facts: null, teamName: null };
  }

  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  if (principal === null) {
    return { presentation, facts: null, teamName: null };
  }

  const reader = await createRuntimeClubContextReader(supabase);
  const read = await reader.read(principal.userId);
  const context = await getCurrentClubContext({
    principal,
    reader: { read: () => Promise.resolve(read) },
  });
  if (context.club === null) {
    return { presentation, facts: null, teamName: null };
  }

  const known = read.teams.find(
    (team) => team.id === teamId && team.clubId === context.club?.id,
  );
  let team = known ?? null;
  if (team === null) {
    const admin = read.memberships.some(
      (membership) =>
        membership.active &&
        membership.role === "CLUB_ADMIN" &&
        membership.clubId === context.club?.id,
    );
    if (admin && context.club !== null) {
      const snapshot = await createSupabaseClubStructureGateway(supabase).list(
        context.club.id,
      );
      const found = snapshot.teams.find((item) => item.id === teamId);
      if (found !== undefined) {
        team = {
          id: found.id,
          name: found.name,
          clubId: context.club.id,
          active: found.active,
        };
      }
    }
  }

  if (team === null || context.club === null) {
    return { presentation, facts: null, teamName: null };
  }

  return {
    presentation,
    teamName: team.name,
    facts: {
      principal,
      clubMemberships: read.memberships,
      teamMemberships: read.teamMemberships,
      guardianLinks: read.guardianLinks,
      registrations: read.registrations,
      clubId: context.club.id,
      teamId: team.id,
      teamActive: team.active,
    },
  };
}
