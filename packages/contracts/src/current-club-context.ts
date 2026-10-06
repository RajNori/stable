import { z } from "zod";

import {
  CLUB_CONTEXT_CAPABILITIES,
  CLUB_MEMBERSHIP_ROLES,
  TEAM_STAFF_ROLES,
} from "./capabilities.js";
import type { Principal } from "./principal.js";

export const clubSummarySchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  timezone: z.string().min(1),
  themeKey: z.string().min(1),
});

export type ClubSummary = z.infer<typeof clubSummarySchema>;

export const teamContextSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1),
});

export type TeamContext = z.infer<typeof teamContextSchema>;

export const teamRecordSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1),
  clubId: z.string().uuid(),
  active: z.boolean(),
});

export type TeamRecord = z.infer<typeof teamRecordSchema>;

export const currentClubContextSchema = z.strictObject({
  userId: z.string().uuid(),
  displayName: z.string().min(1),
  club: clubSummarySchema.nullable(),
  activeTeam: teamContextSchema.nullable(),
  availableTeams: z.array(teamContextSchema),
  capabilities: z.array(z.enum(CLUB_CONTEXT_CAPABILITIES)),
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

export const teamMembershipRecordSchema = z.strictObject({
  clubId: z.string().uuid(),
  teamId: z.string().uuid(),
  role: z.enum(TEAM_STAFF_ROLES),
  active: z.boolean(),
  teamActive: z.boolean(),
});

export type TeamMembershipRecord = z.infer<typeof teamMembershipRecordSchema>;

export const guardianLinkRecordSchema = z.strictObject({
  clubId: z.string().uuid(),
  playerId: z.string().uuid(),
  active: z.boolean(),
  playerActive: z.boolean(),
});

export type GuardianLinkRecord = z.infer<typeof guardianLinkRecordSchema>;

export const registrationRecordSchema = z.strictObject({
  clubId: z.string().uuid(),
  teamId: z.string().uuid(),
  playerId: z.string().uuid(),
  active: z.boolean(),
  teamActive: z.boolean(),
});

export type RegistrationRecord = z.infer<typeof registrationRecordSchema>;

export const clubContextReadResultSchema = z.strictObject({
  displayName: z.string().min(1),
  memberships: z.array(clubMembershipRecordSchema),
  teamMemberships: z.array(teamMembershipRecordSchema),
  guardianLinks: z.array(guardianLinkRecordSchema),
  registrations: z.array(registrationRecordSchema),
  teams: z.array(teamRecordSchema),
  clubs: z.array(clubSummarySchema),
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
