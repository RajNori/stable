import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  AnnouncementAcknowledgement,
  AnnouncementDraft,
  AnnouncementEdit,
  AnnouncementRecord,
  AnnouncementWriter,
} from "../application/announcement-commands.js";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_IMPORTANCE,
  announcementMessages,
} from "../application/announcement-messages.js";

type QueryError = Pick<PostgrestError, "message">;
type QueryResult = { data: unknown; error: QueryError | null };
type AnnouncementClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|CONFLICT)$/;

const recordSchema = z.strictObject({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  team_id: z.string().uuid(),
  author_user_id: z.string().uuid(),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  importance: z.enum(ANNOUNCEMENT_IMPORTANCE),
  title: z.string(),
  body: z.string(),
  acknowledgement_required: z.boolean(),
  published_at: z.string(),
  archived_at: z.string().nullable(),
  read_at: z.string().nullable(),
  acknowledged_at: z.string().nullable(),
});

const progressSchema = z.strictObject({
  user_id: z.string().uuid(),
  acknowledged_at: z.string(),
});

export type AnnouncementGateway = AnnouncementWriter;

export function createSupabaseAnnouncementGateway(
  client: unknown,
): AnnouncementGateway {
  const db = client as AnnouncementClient;
  return {
    publishAnnouncement: (command) => publish(db, command),
    editAnnouncement: (command) => edit(db, command),
    archiveAnnouncement: (announcementId) => archive(db, announcementId),
    listTeamAnnouncements: (input) => list(db, input),
    markAnnouncementRead: (announcementId) => markRead(db, announcementId),
    acknowledgeAnnouncement: (announcementId) =>
      acknowledge(db, announcementId),
    listAnnouncementAcknowledgements: (announcementId) =>
      progress(db, announcementId),
  };
}

function instant(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
}

function toRecord(value: z.infer<typeof recordSchema>): AnnouncementRecord {
  return {
    id: value.id,
    clubId: value.club_id,
    teamId: value.team_id,
    authorUserId: value.author_user_id,
    category: value.category,
    importance: value.importance,
    title: value.title,
    body: value.body,
    acknowledgementRequired: value.acknowledgement_required,
    publishedAt: instant(value.published_at),
    archivedAt: value.archived_at === null ? null : instant(value.archived_at),
    readAt: value.read_at === null ? null : instant(value.read_at),
    acknowledgedAt:
      value.acknowledged_at === null ? null : instant(value.acknowledged_at),
  };
}

async function publish(
  db: AnnouncementClient,
  command: AnnouncementDraft,
): Promise<{ announcementId: string }> {
  return {
    announcementId: uuid(
      await call(db, "publish_announcement", {
        p_club_id: command.clubId,
        p_team_id: command.teamId,
        p_category: command.category,
        p_importance: command.importance,
        p_title: command.title,
        p_body: command.body,
        p_acknowledgement_required: command.acknowledgementRequired,
      }),
    ),
  };
}

async function edit(
  db: AnnouncementClient,
  command: AnnouncementEdit,
): Promise<{ announcementId: string }> {
  return {
    announcementId: uuid(
      await call(db, "edit_announcement", {
        p_announcement_id: command.announcementId,
        p_category: command.category,
        p_importance: command.importance,
        p_title: command.title,
        p_body: command.body,
        p_acknowledgement_required: command.acknowledgementRequired,
      }),
    ),
  };
}

async function archive(
  db: AnnouncementClient,
  announcementId: string,
): Promise<{ announcementId: string }> {
  return {
    announcementId: uuid(
      await call(db, "archive_announcement", {
        p_announcement_id: announcementId,
      }),
    ),
  };
}

async function list(
  db: AnnouncementClient,
  input: { teamId: string; includeArchived: boolean },
): Promise<AnnouncementRecord[]> {
  const data = await call(db, "list_team_announcements", {
    p_team_id: input.teamId,
    p_include_archived: input.includeArchived,
  });
  const rows = z.array(recordSchema).safeParse(data ?? []);
  if (!rows.success) {
    throw new ApplicationError("INTERNAL", announcementMessages.readFailed);
  }
  return rows.data.map(toRecord);
}

async function markRead(
  db: AnnouncementClient,
  announcementId: string,
): Promise<void> {
  await call(db, "mark_announcement_read", {
    p_announcement_id: announcementId,
  });
}

async function acknowledge(
  db: AnnouncementClient,
  announcementId: string,
): Promise<void> {
  await call(db, "acknowledge_announcement", {
    p_announcement_id: announcementId,
  });
}

async function progress(
  db: AnnouncementClient,
  announcementId: string,
): Promise<AnnouncementAcknowledgement[]> {
  const data = await call(db, "list_announcement_acknowledgements", {
    p_announcement_id: announcementId,
  });
  const rows = z.array(progressSchema).safeParse(data ?? []);
  if (!rows.success) {
    throw new ApplicationError("INTERNAL", announcementMessages.readFailed);
  }
  return rows.data.map((row) => ({
    userId: row.user_id,
    acknowledgedAt: instant(row.acknowledged_at),
  }));
}

function uuid(value: unknown): string {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", announcementMessages.saveFailed);
  }
  return parsed.data;
}

async function call(
  db: AnnouncementClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    const code = OPERATION_CODE.exec(result.error.message)?.[1];
    if (code === "UNAUTHENTICATED") {
      throw new ApplicationError(
        "UNAUTHENTICATED",
        announcementMessages.unauthenticated,
      );
    }
    if (code === "FORBIDDEN") {
      throw new ApplicationError("FORBIDDEN", announcementMessages.forbidden);
    }
    if (code === "NOT_FOUND") {
      throw new ApplicationError("NOT_FOUND", announcementMessages.notFound);
    }
    if (code === "VALIDATION_FAILED") {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        announcementMessages.validationFailed,
      );
    }
    if (code === "CONFLICT") {
      throw new ApplicationError("CONFLICT", announcementMessages.conflict);
    }
    throw new ApplicationError("INTERNAL", announcementMessages.readFailed);
  }
  return result.data;
}
