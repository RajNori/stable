import { ApplicationError } from "@stable/contracts";
import type { GuardianLinkFact, MembershipFact, PlayerTeamRegistrationFact, Principal, TeamMembershipFact } from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";
import { z } from "zod";

export const REVIEW_FOCUS_CODES = ["SHOOTING", "BALL_HANDLING", "PASSING", "REBOUNDING", "DEFENCE", "COMMUNICATION", "TEAMWORK", "TRANSITION"] as const;
export const RECOGNITION_CATEGORIES = ["MVP", "HUSTLE", "DEFENCE", "TEAMWORK"] as const;
export type ReviewFocusCode = (typeof REVIEW_FOCUS_CODES)[number];
export type RecognitionCategory = (typeof RECOGNITION_CATEGORIES)[number];

const id = z.string().uuid();
const safeText = (max: number, empty = true) => z.string().trim().max(max).refine((text) => empty || text.length > 0).refine((text) => !/[\x00-\x09\x0b-\x1f\x7f]/u.test(text));
const reviewSaveSchema = z.strictObject({
  eventId: id,
  whatWorked: safeText(2000),
  needsImprovement: safeText(2000),
  focusCodes: z.array(z.enum(REVIEW_FOCUS_CODES)).max(5).refine((items) => new Set(items).size === items.length),
  complete: z.boolean(),
});
const recognitionSchema = z.strictObject({
  eventId: id,
  playerId: id,
  category: z.enum(RECOGNITION_CATEGORIES),
  note: safeText(500).nullable(),
});
const privateNoteSchema = z.strictObject({ eventId: id, playerId: id, note: safeText(2000).nullable() });

export type ReviewSave = z.infer<typeof reviewSaveSchema>;
export type PlayerRecognitionSave = z.infer<typeof recognitionSchema>;
export type PrivatePlayerNoteSave = z.infer<typeof privateNoteSchema>;
export type ReviewRecognition = { playerId: string; category: RecognitionCategory; note: string | null };
export type PostGameReview = {
  eventId: string; clubId: string; teamId: string; whatWorked: string; needsImprovement: string;
  focusCodes: ReviewFocusCode[]; completedBy: string | null; completedAt: string | null;
  recognitions: ReviewRecognition[];
};
export type CoachingReviewAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};
export type CoachingReviewWriter = {
  readPostGameReview(eventId: string): Promise<PostGameReview>;
  savePostGameReview(command: ReviewSave): Promise<void>;
  savePlayerRecognition(command: PlayerRecognitionSave): Promise<void>;
  removePlayerRecognition(eventId: string, playerId: string, category: RecognitionCategory): Promise<void>;
  readPrivatePlayerNote(eventId: string, playerId: string): Promise<string | null>;
  listPrivatePlayerNotes(eventId: string): Promise<{ playerId: string; note: string }[]>;
  savePrivatePlayerNote(command: PrivatePlayerNoteSave): Promise<void>;
};

function fail(code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_FAILED"): never {
  throw new ApplicationError(code, code);
}

function authorize(input: CoachingReviewAccess, clubId: string, teamId: string, capability: "post_game_review.read" | "post_game_review.write" | "recognition.write" | "private_player_note.read" | "private_player_note.write"): void {
  if (input.principal === null) fail("UNAUTHENTICATED");
  if (evaluateCapability({ clubMemberships: input.clubMemberships, teamMemberships: input.teamMemberships, guardianLinks: input.guardianLinks, registrations: input.registrations, resource: { clubId, teamId, teamActive: input.teamActive }, capability }) !== "allow") fail("FORBIDDEN");
}

function ids(clubIdValue: string, teamIdValue: string, eventIdValue: string) {
  const clubId = id.safeParse(clubIdValue); const teamId = id.safeParse(teamIdValue); const eventId = id.safeParse(eventIdValue);
  if (!clubId.success || !teamId.success || !eventId.success) fail("VALIDATION_FAILED");
  return { clubId: clubId.data, teamId: teamId.data, eventId: eventId.data };
}

export async function readPostGameReview(input: CoachingReviewAccess & { clubId: string; teamId: string; eventId: string; writer: CoachingReviewWriter }): Promise<PostGameReview> {
  const target = ids(input.clubId, input.teamId, input.eventId);
  authorize(input, target.clubId, target.teamId, "post_game_review.read");
  const record = await input.writer.readPostGameReview(target.eventId);
  if (record.eventId !== target.eventId || record.clubId !== target.clubId || record.teamId !== target.teamId) fail("NOT_FOUND");
  return record;
}

export async function savePostGameReview(input: CoachingReviewAccess & ReviewSave & { clubId: string; teamId: string; writer: CoachingReviewWriter }): Promise<void> {
  const parsed = reviewSaveSchema.safeParse({ eventId: input.eventId, whatWorked: input.whatWorked, needsImprovement: input.needsImprovement, focusCodes: input.focusCodes, complete: input.complete });
  const target = ids(input.clubId, input.teamId, input.eventId);
  if (!parsed.success) fail("VALIDATION_FAILED");
  authorize(input, target.clubId, target.teamId, "post_game_review.write");
  await input.writer.savePostGameReview(parsed.data);
}

export async function savePlayerRecognition(input: CoachingReviewAccess & PlayerRecognitionSave & { clubId: string; teamId: string; writer: CoachingReviewWriter }): Promise<void> {
  const parsed = recognitionSchema.safeParse({ eventId: input.eventId, playerId: input.playerId, category: input.category, note: input.note });
  const target = ids(input.clubId, input.teamId, input.eventId);
  if (!parsed.success) fail("VALIDATION_FAILED");
  authorize(input, target.clubId, target.teamId, "recognition.write");
  await input.writer.savePlayerRecognition(parsed.data);
}

export async function removePlayerRecognition(input: CoachingReviewAccess & { clubId: string; teamId: string; eventId: string; playerId: string; category: RecognitionCategory; writer: CoachingReviewWriter }): Promise<void> {
  const eventId = id.safeParse(input.eventId); const playerId = id.safeParse(input.playerId); const category = z.enum(RECOGNITION_CATEGORIES).safeParse(input.category);
  const target = ids(input.clubId, input.teamId, input.eventId);
  if (!eventId.success || !playerId.success || !category.success) fail("VALIDATION_FAILED");
  authorize(input, target.clubId, target.teamId, "recognition.write");
  await input.writer.removePlayerRecognition(eventId.data, playerId.data, category.data);
}

export async function readPrivatePlayerNote(input: CoachingReviewAccess & { clubId: string; teamId: string; eventId: string; playerId: string; writer: CoachingReviewWriter }): Promise<string | null> {
  const target = ids(input.clubId, input.teamId, input.eventId); const playerId = id.safeParse(input.playerId);
  if (!playerId.success) fail("VALIDATION_FAILED");
  authorize(input, target.clubId, target.teamId, "private_player_note.read");
  return input.writer.readPrivatePlayerNote(target.eventId, playerId.data);
}

export async function listPrivatePlayerNotes(input: CoachingReviewAccess & { clubId: string; teamId: string; eventId: string; writer: CoachingReviewWriter }): Promise<{ playerId: string; note: string }[]> {
  const target = ids(input.clubId, input.teamId, input.eventId);
  authorize(input, target.clubId, target.teamId, "private_player_note.read");
  return input.writer.listPrivatePlayerNotes(target.eventId);
}

export async function savePrivatePlayerNote(input: CoachingReviewAccess & PrivatePlayerNoteSave & { clubId: string; teamId: string; writer: CoachingReviewWriter }): Promise<void> {
  const parsed = privateNoteSchema.safeParse({ eventId: input.eventId, playerId: input.playerId, note: input.note });
  const target = ids(input.clubId, input.teamId, input.eventId);
  if (!parsed.success) fail("VALIDATION_FAILED");
  authorize(input, target.clubId, target.teamId, "private_player_note.write");
  await input.writer.savePrivatePlayerNote(parsed.data);
}
