"use server";

import { ApplicationError } from "@stable/contracts";
import {
  clubStructureMessages,
  createSeasonAndTeam,
  createSupabaseClubStructureGateway,
} from "@stable/club-structure";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";

export async function createSeasonAndTeamAction(
  formData: FormData,
): Promise<void> {
  const seasonName = formData.get("seasonName");
  const teamName = formData.get("teamName");
  const clubId = formData.get("clubId");
  if (
    typeof seasonName !== "string" ||
    typeof teamName !== "string" ||
    typeof clubId !== "string"
  ) {
    redirect(structureErrorUrl(clubStructureMessages.validationFailed));
  }

  const supabase = await createSupabaseServerClient();
  const gateway = createSupabaseClubStructureGateway(supabase);

  try {
    const session = await gateway.readSession();
    await createSeasonAndTeam({
      principal: session.principal,
      memberships: session.memberships,
      clubId,
      seasonName,
      teamName,
      writer: gateway.writer,
    });
  } catch (error: unknown) {
    const message =
      error instanceof ApplicationError
        ? error.message
        : clubStructureMessages.saveFailed;
    redirect(structureErrorUrl(message));
  }

  redirect("/club-structure");
}

function structureErrorUrl(message: string): string {
  return `/club-structure?error=${encodeURIComponent(message)}`;
}
