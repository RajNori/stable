import { z } from "zod";

import { CLUB_MEMBERSHIP_ROLES, KNOWN_CAPABILITIES } from "./capabilities.js";
import type { Principal } from "./principal.js";

export const clubSummarySchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  timezone: z.string().min(1),
  themeKey: z.string().min(1),
});

export type ClubSummary = z.infer<typeof clubSummarySchema>;

export const currentClubContextSchema = z.strictObject({
  userId: z.string().uuid(),
  displayName: z.string().min(1),
  club: clubSummarySchema.nullable(),
  activeTeam: z.null(),
  capabilities: z.array(z.enum(KNOWN_CAPABILITIES)),
  managedPlayerIds: z.array(z.string().uuid()),
});

export type CurrentClubContext = z.infer<typeof currentClubContextSchema>;

export const clubMembershipRecordSchema = z.strictObject({
  clubId: z.string().uuid(),
  role: z.enum(CLUB_MEMBERSHIP_ROLES),
  active: z.boolean(),
  club: clubSummarySchema,
});

export type ClubMembershipRecord = z.infer<typeof clubMembershipRecordSchema>;

export const clubContextReadResultSchema = z.strictObject({
  displayName: z.string().min(1),
  memberships: z.array(clubMembershipRecordSchema),
});

export type ClubContextReadResult = z.infer<typeof clubContextReadResultSchema>;

export type ClubContextReader = {
  read(userId: string): Promise<ClubContextReadResult>;
};

export type GetCurrentClubContextInput = {
  principal: Principal | null;
  reader: ClubContextReader;
};

export type GetCurrentClubContext = (
  input: GetCurrentClubContextInput,
) => Promise<CurrentClubContext>;
