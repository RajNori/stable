"use server";

import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_IMPORTANCE,
  acknowledgeAnnouncement,
  announcementMessages,
  archiveAnnouncement,
  createSupabaseAnnouncementGateway,
  markAnnouncementRead,
  publishAnnouncement,
  type AnnouncementCategory,
  type AnnouncementImportance,
} from "@stable/announcements";
import {
  createSupabaseNotificationGateway,
  enqueueAnnouncementPublished,
} from "@stable/notifications";
import { redirect } from "next/navigation";

import { fixtureAccessFrom } from "../../../../lib/fixture-access";
import { principalFromSupabase } from "../../../../lib/principal";
import { createRuntimeClubContextReader } from "../../../../lib/runtime-club-context-reader";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function destination(teamId: string): string {
  return `/teams/${teamId}/announcements`;
}

function withError(path: string, message: string): string {
  return `${path}?error=${encodeURIComponent(message)}`;
}

function isCategory(value: string): value is AnnouncementCategory {
  return ANNOUNCEMENT_CATEGORIES.some((category) => category === value);
}

function isImportance(value: string): value is AnnouncementImportance {
  return ANNOUNCEMENT_IMPORTANCE.some((importance) => importance === value);
}

async function loadAccess(clubId: string, teamId: string) {
  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  const reader = await createRuntimeClubContextReader(supabase);
  const facts = principal === null ? null : await reader.read(principal.userId);
  const team = facts?.teams.find((item) => item.id === teamId);
  if (
    principal === null ||
    facts === null ||
    team === undefined ||
    team.clubId !== clubId
  ) {
    return null;
  }
  return {
    supabase,
    access: fixtureAccessFrom(principal, facts, team.active),
  };
}

export async function publishAnnouncementAction(
  formData: FormData,
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const title = text(formData, "title");
  const body = text(formData, "body");
  const category = text(formData, "category");
  const importance = text(formData, "importance");
  if (
    clubId === null ||
    teamId === null ||
    title === null ||
    body === null ||
    category === null ||
    importance === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId) ||
    !isCategory(category) ||
    !isImportance(importance)
  ) {
    redirect(
      teamId !== null && UUID.test(teamId)
        ? withError(destination(teamId), announcementMessages.validationFailed)
        : "/",
    );
  }

  const loaded = await loadAccess(clubId, teamId);
  if (loaded === null) {
    redirect(
      withError(destination(teamId), announcementMessages.unauthenticated),
    );
  }

  const categoryValue = category;
  const importanceValue = importance;
  if (!isCategory(categoryValue) || !isImportance(importanceValue)) {
    redirect(
      withError(destination(teamId), announcementMessages.validationFailed),
    );
  }

  try {
    await publishAnnouncement({
      ...loaded.access,
      clubId,
      teamId,
      category: categoryValue,
      importance: importanceValue,
      title,
      body,
      acknowledgementRequired: formData.get("acknowledgementRequired") === "on",
      writer: createSupabaseAnnouncementGateway(loaded.supabase),
      notify: {
        announcementPublished: async (published) => {
          await enqueueAnnouncementPublished({
            principal: loaded.access.principal,
            announcementId: published.announcementId,
            writer: createSupabaseNotificationGateway(loaded.supabase),
          });
        },
      },
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error
        ? caught.message
        : announcementMessages.saveFailed;
    redirect(withError(destination(teamId), message));
  }

  redirect(destination(teamId));
}

async function respond(
  formData: FormData,
  action: "read" | "ack" | "archive",
): Promise<void> {
  const clubId = text(formData, "clubId");
  const teamId = text(formData, "teamId");
  const announcementId = text(formData, "announcementId");
  if (
    clubId === null ||
    teamId === null ||
    announcementId === null ||
    !UUID.test(clubId) ||
    !UUID.test(teamId) ||
    !UUID.test(announcementId)
  ) {
    redirect(
      teamId !== null && UUID.test(teamId)
        ? withError(destination(teamId), announcementMessages.validationFailed)
        : "/",
    );
  }

  const loaded = await loadAccess(clubId, teamId);
  if (loaded === null) {
    redirect(
      withError(destination(teamId), announcementMessages.unauthenticated),
    );
  }

  const writer = createSupabaseAnnouncementGateway(loaded.supabase);
  try {
    if (action === "read") {
      await markAnnouncementRead({
        ...loaded.access,
        clubId,
        teamId,
        announcementId,
        writer,
      });
    } else if (action === "ack") {
      await acknowledgeAnnouncement({
        ...loaded.access,
        clubId,
        teamId,
        announcementId,
        writer,
      });
    } else {
      await archiveAnnouncement({
        ...loaded.access,
        announcementId,
        writer,
      });
    }
  } catch (caught: unknown) {
    const message =
      caught instanceof Error
        ? caught.message
        : announcementMessages.saveFailed;
    redirect(withError(destination(teamId), message));
  }

  redirect(destination(teamId));
}

export async function markAnnouncementReadAction(
  formData: FormData,
): Promise<void> {
  await respond(formData, "read");
}

export async function acknowledgeAnnouncementAction(
  formData: FormData,
): Promise<void> {
  await respond(formData, "ack");
}

export async function archiveAnnouncementAction(
  formData: FormData,
): Promise<void> {
  await respond(formData, "archive");
}
