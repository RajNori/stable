import { principalFromSession } from "@stable/auth";
import {
  acknowledgeAnnouncement,
  announcementMessages,
  createSupabaseAnnouncementGateway,
  listTeamAnnouncements,
  markAnnouncementRead,
  type AnnouncementRecord,
} from "@stable/announcements";
import { ApplicationError } from "@stable/contracts";
import type { User } from "@supabase/supabase-js";

import { getMobileSupabaseClient } from "./supabase-client";
import { createMobileClubContextReader } from "./supabase-reader";

function readDisplayName(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }

  const value = Object.getOwnPropertyDescriptor(
    metadata,
    "display_name",
  )?.value;
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

function sessionIdentityFromUser(user: User): {
  id: string;
  displayName?: string;
} {
  const displayName = readDisplayName(user.user_metadata);
  if (displayName === undefined) {
    return { id: user.id };
  }

  return { id: user.id, displayName };
}

async function accessFor(teamId: string) {
  const client = getMobileSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error !== null) {
    throw new Error("The session could not be read.");
  }

  const user = data.session?.user;
  const principal = principalFromSession(
    user === undefined ? null : sessionIdentityFromUser(user),
  );
  if (principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      announcementMessages.unauthenticated,
    );
  }

  const read = await createMobileClubContextReader(client).read(
    principal.userId,
  );
  const team = read.teams.find((item) => item.id === teamId);
  return {
    client,
    access: {
      principal,
      clubMemberships: read.memberships.map((membership) => ({
        clubId: membership.clubId,
        role: membership.role,
        active: membership.active,
      })),
      teamMemberships: read.teamMemberships,
      guardianLinks: read.guardianLinks,
      registrations: read.registrations,
      teamActive: team?.active === true,
    },
    clubId: team?.clubId ?? read.clubs[0]?.id ?? teamId,
    teamId,
  };
}

export async function loadMobileAnnouncements(
  teamId: string,
): Promise<AnnouncementRecord[]> {
  const loaded = await accessFor(teamId);
  return listTeamAnnouncements({
    ...loaded.access,
    clubId: loaded.clubId,
    teamId: loaded.teamId,
    includeArchived: false,
    writer: createSupabaseAnnouncementGateway(loaded.client),
  });
}

export async function acknowledgeMobileAnnouncement(
  announcement: AnnouncementRecord,
): Promise<void> {
  const loaded = await accessFor(announcement.teamId);
  await acknowledgeAnnouncement({
    ...loaded.access,
    clubId: announcement.clubId,
    teamId: announcement.teamId,
    announcementId: announcement.id,
    writer: createSupabaseAnnouncementGateway(loaded.client),
  });
}

export async function markMobileAnnouncementRead(
  announcement: AnnouncementRecord,
): Promise<void> {
  const loaded = await accessFor(announcement.teamId);
  await markAnnouncementRead({
    ...loaded.access,
    clubId: announcement.clubId,
    teamId: announcement.teamId,
    announcementId: announcement.id,
    writer: createSupabaseAnnouncementGateway(loaded.client),
  });
}
