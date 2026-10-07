import { ApplicationError } from "@stable/contracts";
import {
  announcementMessages,
  createSupabaseAnnouncementGateway,
  listAnnouncementProgress,
  listTeamAnnouncements,
} from "@stable/announcements";
import { getCurrentClubContext } from "@stable/current-club-context";
import { createSupabaseFixtureGateway } from "@stable/fixtures";
import { evaluateCapability } from "@stable/permissions";

import { AnnouncementsPanel } from "../../../../components/announcements-panel";
import { ClubAdminShell } from "../../../../components/club-admin-shell";
import { fixtureAccessFrom } from "../../../../lib/fixture-access";
import { loadLiveClubContext } from "../../../../lib/load-live-club-context";
import { principalFromSupabase } from "../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  acknowledgeAnnouncementAction,
  archiveAnnouncementAction,
  markAnnouncementReadAction,
  publishAnnouncementAction,
} from "./actions";

export const dynamic = "force-dynamic";

type AnnouncementsPageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const visibleErrors = new Set<string>(Object.values(announcementMessages));

export default async function AnnouncementsPage({
  params,
  searchParams,
}: AnnouncementsPageProps) {
  const { teamId } = await params;
  const query = await searchParams;
  const queryError = query["error"];
  const requestedError = Array.isArray(queryError) ? queryError[0] : queryError;
  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return <ClubAdminShell presentation={presentation} />;
  }

  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  const reader = await createRuntimeClubContextReader(supabase);
  const context = await getCurrentClubContext({ principal, reader });
  const club = context.club;
  if (club === null || principal === null) {
    return <ClubAdminShell presentation={presentation} />;
  }

  const team =
    await createSupabaseFixtureGateway(supabase).readVisibleTeam(teamId);
  if (team === null || team.clubId !== club.id) {
    return (
      <ClubAdminShell presentation={presentation}>
        <p role="alert">{announcementMessages.notFound}</p>
      </ClubAdminShell>
    );
  }

  const facts = await reader.read(principal.userId);
  const access = fixtureAccessFrom(principal, facts, team.active);
  const resource = {
    clubId: club.id,
    teamId: team.id,
    teamActive: team.active,
  };
  const canPublish =
    evaluateCapability({
      ...access,
      resource,
      capability: "announcement.publish",
    }) === "allow";
  let error =
    requestedError !== undefined && visibleErrors.has(requestedError)
      ? requestedError
      : undefined;
  let announcements: Awaited<ReturnType<typeof listTeamAnnouncements>> = [];
  const writer = createSupabaseAnnouncementGateway(supabase);
  try {
    announcements = await listTeamAnnouncements({
      ...access,
      clubId: club.id,
      teamId: team.id,
      includeArchived: canPublish,
      writer,
    });
  } catch (caught: unknown) {
    error =
      caught instanceof ApplicationError
        ? caught.message
        : announcementMessages.readFailed;
  }

  const withProgress = await Promise.all(
    announcements.map(async (announcement) => {
      if (!canPublish) {
        return { ...announcement, progressCount: 0 };
      }
      const progress = await listAnnouncementProgress({
        ...access,
        clubId: club.id,
        teamId: team.id,
        announcementId: announcement.id,
        writer,
      });
      return { ...announcement, progressCount: progress.length };
    }),
  );

  return (
    <ClubAdminShell presentation={presentation}>
      <AnnouncementsPanel
        clubId={club.id}
        teamId={team.id}
        announcements={withProgress}
        canPublish={canPublish}
        {...(error === undefined ? {} : { error })}
        publish={publishAnnouncementAction}
        acknowledge={acknowledgeAnnouncementAction}
        markRead={markAnnouncementReadAction}
        archive={archiveAnnouncementAction}
      />
    </ClubAdminShell>
  );
}
