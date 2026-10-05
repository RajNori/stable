import { z } from "zod";

export const clubStructureNameSchema = z.string().trim().min(1).max(120);

export const CLUB_STRUCTURE_ACTIONS = [
  "season.created",
  "season.updated",
  "competition.created",
  "competition.updated",
  "team.created",
  "team.updated",
  "venue.created",
  "venue.updated",
] as const;

export type ClubStructureAction = (typeof CLUB_STRUCTURE_ACTIONS)[number];

export const seasonSchema = z.strictObject({
  id: z.string().uuid(),
  clubId: z.string().uuid(),
  name: clubStructureNameSchema,
  active: z.boolean(),
});

export type Season = z.infer<typeof seasonSchema>;

export const competitionSchema = z.strictObject({
  id: z.string().uuid(),
  clubId: z.string().uuid(),
  seasonId: z.string().uuid(),
  name: clubStructureNameSchema,
  active: z.boolean(),
});

export type Competition = z.infer<typeof competitionSchema>;

export const venueSchema = z.strictObject({
  id: z.string().uuid(),
  clubId: z.string().uuid(),
  name: clubStructureNameSchema,
  active: z.boolean(),
});

export type Venue = z.infer<typeof venueSchema>;

export const teamSchema = z.strictObject({
  id: z.string().uuid(),
  clubId: z.string().uuid(),
  seasonId: z.string().uuid(),
  competitionId: z.string().uuid().nullable(),
  venueId: z.string().uuid().nullable(),
  name: clubStructureNameSchema,
  active: z.boolean(),
});

export type Team = z.infer<typeof teamSchema>;

export const auditEventSchema = z.strictObject({
  id: z.string().uuid(),
  clubId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  action: z.enum(CLUB_STRUCTURE_ACTIONS),
  targetId: z.string().uuid(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const clubStructureSnapshotSchema = z.strictObject({
  seasons: z.array(seasonSchema),
  competitions: z.array(competitionSchema),
  teams: z.array(teamSchema),
  venues: z.array(venueSchema),
});

export type ClubStructureSnapshot = z.infer<typeof clubStructureSnapshotSchema>;
