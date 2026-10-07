import { ApplicationError } from "@stable/contracts";
import { z } from "zod";

import type {
  CoachingReviewWriter,
  PostGameReview,
  RecognitionCategory,
  ReviewFocusCode,
} from "../application/review-commands.js";
import {
  RECOGNITION_CATEGORIES,
  REVIEW_FOCUS_CODES,
} from "../application/review-commands.js";

type QueryResult = { data: unknown; error: { message: string } | null };
type ReviewClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};
const operationCode =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|CONFLICT)$/;
const recognitionSchema = z.strictObject({
  player_id: z.string().uuid(),
  category: z.enum(RECOGNITION_CATEGORIES),
  note: z.string().nullable(),
});
const reviewSchema = z.strictObject({
  event_id: z.string().uuid(),
  club_id: z.string().uuid(),
  team_id: z.string().uuid(),
  what_worked: z.string(),
  needs_improvement: z.string(),
  focus_codes: z.array(z.enum(REVIEW_FOCUS_CODES)),
  completed_by: z.string().uuid().nullable(),
  completed_at: z.string().datetime({ offset: true }).nullable(),
  recognitions: z.array(recognitionSchema),
});

export function createSupabaseReviewGateway(
  client: unknown,
): CoachingReviewWriter {
  const db = client as ReviewClient;
  return {
    readPostGameReview: (eventId) => readReview(db, eventId),
    savePostGameReview: (command) => saveReview(db, command),
    savePlayerRecognition: (command) => saveRecognition(db, command),
    removePlayerRecognition: (eventId, playerId, category) =>
      removeRecognition(db, eventId, playerId, category),
    readPrivatePlayerNote: (eventId, playerId) =>
      readPrivateNote(db, eventId, playerId),
    listPrivatePlayerNotes: (eventId) => listPrivateNotes(db, eventId),
    savePrivatePlayerNote: (command) => savePrivateNote(db, command),
  };
}

async function readReview(
  db: ReviewClient,
  eventId: string,
): Promise<PostGameReview> {
  const data = await call(db, "read_post_game_review", { p_event_id: eventId });
  const rows = z.array(reviewSchema).safeParse(data);
  const row = rows.success ? rows.data[0] : undefined;
  if (row === undefined)
    throw new ApplicationError(
      "INTERNAL",
      "Post-game review could not be loaded.",
    );
  return {
    eventId: row.event_id,
    clubId: row.club_id,
    teamId: row.team_id,
    whatWorked: row.what_worked,
    needsImprovement: row.needs_improvement,
    focusCodes: row.focus_codes as ReviewFocusCode[],
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    recognitions: row.recognitions.map((recognition) => ({
      playerId: recognition.player_id,
      category: recognition.category as RecognitionCategory,
      note: recognition.note,
    })),
  };
}

async function saveReview(
  db: ReviewClient,
  command: Parameters<CoachingReviewWriter["savePostGameReview"]>[0],
): Promise<void> {
  await call(db, "save_post_game_review", {
    p_event_id: command.eventId,
    p_what_worked: command.whatWorked,
    p_needs_improvement: command.needsImprovement,
    p_focus_codes: command.focusCodes,
    p_complete: command.complete,
  });
}

async function saveRecognition(
  db: ReviewClient,
  command: Parameters<CoachingReviewWriter["savePlayerRecognition"]>[0],
): Promise<void> {
  await call(db, "save_player_game_recognition", {
    p_event_id: command.eventId,
    p_player_id: command.playerId,
    p_category: command.category,
    p_note: command.note,
  });
}

async function removeRecognition(
  db: ReviewClient,
  eventId: string,
  playerId: string,
  category: RecognitionCategory,
): Promise<void> {
  await call(db, "remove_player_game_recognition", {
    p_event_id: eventId,
    p_player_id: playerId,
    p_category: category,
  });
}

async function readPrivateNote(
  db: ReviewClient,
  eventId: string,
  playerId: string,
): Promise<string | null> {
  const data = await call(db, "read_private_player_game_note", {
    p_event_id: eventId,
    p_player_id: playerId,
  });
  const parsed = z.string().nullable().safeParse(data);
  if (!parsed.success)
    throw new ApplicationError(
      "INTERNAL",
      "Private coaching note could not be loaded.",
    );
  return parsed.data;
}

async function listPrivateNotes(
  db: ReviewClient,
  eventId: string,
): Promise<{ playerId: string; note: string }[]> {
  const data = await call(db, "list_private_player_game_notes", {
    p_event_id: eventId,
  });
  const parsed = z
    .array(z.strictObject({ player_id: z.string().uuid(), note: z.string() }))
    .safeParse(data);
  if (!parsed.success)
    throw new ApplicationError(
      "INTERNAL",
      "Private coaching notes could not be loaded.",
    );
  return parsed.data.map((row) => ({
    playerId: row.player_id,
    note: row.note,
  }));
}

async function savePrivateNote(
  db: ReviewClient,
  command: Parameters<CoachingReviewWriter["savePrivatePlayerNote"]>[0],
): Promise<void> {
  await call(db, "save_private_player_game_note", {
    p_event_id: command.eventId,
    p_player_id: command.playerId,
    p_note: command.note,
  });
}

async function call(
  db: ReviewClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error === null) return result.data;
  const code = operationCode.exec(result.error.message)?.[1];
  if (
    code === "UNAUTHENTICATED" ||
    code === "FORBIDDEN" ||
    code === "NOT_FOUND" ||
    code === "VALIDATION_FAILED" ||
    code === "CONFLICT"
  )
    throw new ApplicationError(code, code);
  throw new ApplicationError(
    "INTERNAL",
    "Coaching review could not be saved or loaded.",
  );
}
