import { ApplicationError } from "@stable/contracts";
import type {
  GuardianLinkFact,
  MembershipFact,
  PlayerTeamRegistrationFact,
  Principal,
  TeamMembershipFact,
} from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";
import { z } from "zod";

import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_IMPORTANCE,
  announcementMessages,
} from "./announcement-messages.js";

const idSchema = z.string().uuid();

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code <= 31 || code === 127)) {
      return true;
    }
  }
  return false;
}

const textSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasControlCharacter(value));

export const announcementDraftSchema = z.strictObject({
  clubId: idSchema,
  teamId: idSchema,
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  importance: z.enum(ANNOUNCEMENT_IMPORTANCE),
  title: textSchema(120),
  body: textSchema(2000),
  acknowledgementRequired: z.boolean(),
});

export const announcementEditSchema = announcementDraftSchema
  .omit({ clubId: true, teamId: true })
  .extend({ announcementId: idSchema });

export type AnnouncementDraft = z.infer<typeof announcementDraftSchema>;
export type AnnouncementEdit = z.infer<typeof announcementEditSchema>;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];
export type AnnouncementImportance = (typeof ANNOUNCEMENT_IMPORTANCE)[number];

export type AnnouncementRecord = {
  id: string;
  clubId: string;
  teamId: string;
  authorUserId: string;
  category: AnnouncementCategory;
  importance: AnnouncementImportance;
  title: string;
  body: string;
  acknowledgementRequired: boolean;
  publishedAt: string;
  archivedAt: string | null;
  readAt: string | null;
  acknowledgedAt: string | null;
};

export type AnnouncementAcknowledgement = {
  userId: string;
  acknowledgedAt: string;
};

export type AnnouncementAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};

export type AnnouncementWriter = {
  publishAnnouncement(
    command: AnnouncementDraft,
  ): Promise<{ announcementId: string }>;
  editAnnouncement(
    command: AnnouncementEdit,
  ): Promise<{ announcementId: string }>;
  archiveAnnouncement(
    announcementId: string,
  ): Promise<{ announcementId: string }>;
  listTeamAnnouncements(input: {
    teamId: string;
    includeArchived: boolean;
  }): Promise<AnnouncementRecord[]>;
  markAnnouncementRead(announcementId: string): Promise<void>;
  acknowledgeAnnouncement(announcementId: string): Promise<void>;
  listAnnouncementAcknowledgements(
    announcementId: string,
  ): Promise<AnnouncementAcknowledgement[]>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    announcementMessages.validationFailed,
  );
}

function assertAllowed(
  input: AnnouncementAccess,
  clubId: string,
  teamId: string,
  capability: string,
): void {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      announcementMessages.unauthenticated,
    );
  }
  if (
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: { clubId, teamId, teamActive: input.teamActive },
      capability,
    }) !== "allow"
  ) {
    throw new ApplicationError("FORBIDDEN", announcementMessages.forbidden);
  }
}

export async function publishAnnouncement(
  input: AnnouncementAccess &
    AnnouncementDraft & {
      writer: AnnouncementWriter;
      notify?: {
        announcementPublished(published: {
          announcementId: string;
          clubId: string;
          teamId: string;
        }): Promise<void>;
      };
    },
): Promise<{ announcementId: string }> {
  const command = announcementDraftSchema.safeParse({
    clubId: input.clubId,
    teamId: input.teamId,
    category: input.category,
    importance: input.importance,
    title: input.title,
    body: input.body,
    acknowledgementRequired: input.acknowledgementRequired,
  });
  if (!command.success) {
    validationFailed();
  }
  assertAllowed(
    input,
    command.data.clubId,
    command.data.teamId,
    "announcement.publish",
  );
  const published = await input.writer.publishAnnouncement(command.data);
  if (input.notify !== undefined) {
    try {
      await input.notify.announcementPublished({
        announcementId: published.announcementId,
        clubId: command.data.clubId,
        teamId: command.data.teamId,
      });
    } catch {
      return published;
    }
  }
  return published;
}

export async function editAnnouncement(
  input: AnnouncementAccess & AnnouncementEdit & { writer: AnnouncementWriter },
): Promise<{ announcementId: string }> {
  const command = announcementEditSchema.safeParse({
    announcementId: input.announcementId,
    category: input.category,
    importance: input.importance,
    title: input.title,
    body: input.body,
    acknowledgementRequired: input.acknowledgementRequired,
  });
  if (!command.success) {
    validationFailed();
  }
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      announcementMessages.unauthenticated,
    );
  }
  return input.writer.editAnnouncement(command.data);
}

export async function archiveAnnouncement(
  input: AnnouncementAccess & {
    announcementId: string;
    writer: AnnouncementWriter;
  },
): Promise<{ announcementId: string }> {
  const announcementId = idSchema.safeParse(input.announcementId);
  if (!announcementId.success) {
    validationFailed();
  }
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      announcementMessages.unauthenticated,
    );
  }
  return input.writer.archiveAnnouncement(announcementId.data);
}

export async function listTeamAnnouncements(
  input: AnnouncementAccess & {
    clubId: string;
    teamId: string;
    includeArchived: boolean;
    writer: AnnouncementWriter;
  },
): Promise<AnnouncementRecord[]> {
  const teamId = idSchema.safeParse(input.teamId);
  const clubId = idSchema.safeParse(input.clubId);
  if (!teamId.success || !clubId.success) {
    validationFailed();
  }
  assertAllowed(input, clubId.data, teamId.data, "announcement.read");
  const canPublish =
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: {
        clubId: clubId.data,
        teamId: teamId.data,
        teamActive: input.teamActive,
      },
      capability: "announcement.publish",
    }) === "allow";
  return input.writer.listTeamAnnouncements({
    teamId: teamId.data,
    includeArchived: input.includeArchived && canPublish,
  });
}

export async function acknowledgeAnnouncement(
  input: AnnouncementAccess & {
    clubId: string;
    teamId: string;
    announcementId: string;
    writer: AnnouncementWriter;
  },
): Promise<void> {
  const announcementId = idSchema.safeParse(input.announcementId);
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!announcementId.success || !clubId.success || !teamId.success) {
    validationFailed();
  }
  assertAllowed(input, clubId.data, teamId.data, "announcement.ack");
  await input.writer.acknowledgeAnnouncement(announcementId.data);
}

export async function listAnnouncementProgress(
  input: AnnouncementAccess & {
    clubId: string;
    teamId: string;
    announcementId: string;
    writer: AnnouncementWriter;
  },
): Promise<AnnouncementAcknowledgement[]> {
  const announcementId = idSchema.safeParse(input.announcementId);
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!announcementId.success || !clubId.success || !teamId.success) {
    validationFailed();
  }
  assertAllowed(input, clubId.data, teamId.data, "announcement.publish");
  return input.writer.listAnnouncementAcknowledgements(announcementId.data);
}

export async function markAnnouncementRead(
  input: AnnouncementAccess & {
    clubId: string;
    teamId: string;
    announcementId: string;
    writer: AnnouncementWriter;
  },
): Promise<void> {
  const announcementId = idSchema.safeParse(input.announcementId);
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!announcementId.success || !clubId.success || !teamId.success) {
    validationFailed();
  }
  assertAllowed(input, clubId.data, teamId.data, "announcement.read");
  await input.writer.markAnnouncementRead(announcementId.data);
}
