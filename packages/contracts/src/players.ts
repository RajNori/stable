import { z } from "zod";

export const PLAYER_NAME_MAX_LENGTH = 80;
export const PLAYER_IMPORT_MAX_ROWS = 50;
export const PLAYER_IMPORT_SOURCE = "club_admin_import";

function hasAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

function trimAsciiSpaces(value: string): string {
  return value.replace(/^[ ]+/u, "").replace(/[ ]+$/u, "");
}

/**
 * Persistence trims only ASCII spaces, matching PostgreSQL btrim.
 * ASCII control characters are rejected. The masked display name is not stored.
 */
export const playerNameSchema = z
  .string()
  .superRefine((value, context) => {
    if (hasAsciiControl(value)) {
      context.addIssue({ code: "custom", message: "invalid" });
      return;
    }
    const trimmed = trimAsciiSpaces(value);
    if (trimmed.length < 1 || trimmed.length > PLAYER_NAME_MAX_LENGTH) {
      context.addIssue({ code: "custom", message: "invalid" });
    }
  })
  .transform((value) => trimAsciiSpaces(value));

export function normalizePlayerName(value: unknown): string | null {
  const parsed = playerNameSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const playerSchema = z.strictObject({
  id: z.string().uuid(),
  clubId: z.string().uuid(),
  firstName: playerNameSchema,
  lastName: playerNameSchema,
  active: z.boolean(),
});

export type Player = z.infer<typeof playerSchema>;

export const playerSummarySchema = z.strictObject({
  id: z.string().uuid(),
  displayName: z.string().trim().min(1),
});

export type PlayerSummary = z.infer<typeof playerSummarySchema>;

const adultDisplayNameSchema = z.string().trim().min(1).max(200);

export const clubAdultSchema = z.strictObject({
  userId: z.string().uuid(),
  displayName: adultDisplayNameSchema,
});

export type ClubAdult = z.infer<typeof clubAdultSchema>;

export const guardianLinkSchema = z.strictObject({
  id: z.string().uuid(),
  playerId: z.string().uuid(),
  guardianUserId: z.string().uuid(),
  active: z.boolean(),
  displayName: adultDisplayNameSchema.optional(),
});

export type GuardianLink = z.infer<typeof guardianLinkSchema>;

export const playerImportRowSchema = z.strictObject({
  firstName: playerNameSchema,
  lastName: playerNameSchema,
  sourcePlayerId: playerNameSchema,
});

export type PlayerImportRow = z.infer<typeof playerImportRowSchema>;

export const PLAYER_IMPORT_STATUSES = ["created", "existing"] as const;

export const playerImportResultSchema = z.strictObject({
  sourcePlayerId: playerNameSchema,
  playerId: z.string().uuid(),
  status: z.enum(PLAYER_IMPORT_STATUSES),
});

export type PlayerImportResult = z.infer<typeof playerImportResultSchema>;
