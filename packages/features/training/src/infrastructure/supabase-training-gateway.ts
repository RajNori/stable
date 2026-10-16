import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  TrainingEditMetadata,
  TrainingFollowingEdit,
  TrainingOccurrenceEdit,
  TrainingSeries,
  TrainingSeriesEdit,
  TrainingSession,
  TrainingWriter,
} from "../application/training-commands.js";
import { trainingMessages } from "../application/training-messages.js";

type QueryError = Pick<PostgrestError, "message">;
type QueryResult = { data: unknown; error: QueryError | null };
type TrainingClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|CONFLICT)$/;

const editMetadataRowSchema = z
  .strictObject({
    event_id: z.string().uuid(),
    recurrence_series_id: z.string().uuid().nullable(),
    weekday: z.number().int().min(1).max(7).nullable(),
    local_time: z
      .string()
      .regex(/^\d{2}:\d{2}(?::\d{2})?$/)
      .nullable(),
    timezone: z.string().nullable(),
    ends_on: z.string().nullable(),
    lead_coach_user_id: z.string().uuid().nullable(),
  })
  .superRefine((row, context) => {
    const hasSeries = row.recurrence_series_id !== null;
    const hasSchedule =
      row.weekday !== null && row.local_time !== null && row.timezone !== null;
    if (hasSeries !== hasSchedule) {
      context.addIssue({ code: "custom", message: "series metadata" });
    }
  })
  .transform((row): TrainingEditMetadata => ({
    eventId: row.event_id,
    recurrenceSeriesId: row.recurrence_series_id,
    weekday: row.weekday,
    localTime: row.local_time?.slice(0, 5) ?? null,
    timezone: row.timezone,
    endsOn: row.ends_on,
    leadCoachUserId: row.lead_coach_user_id,
  }));

export type TrainingGateway = TrainingWriter;

export function createSupabaseTrainingGateway(
  client: unknown,
): TrainingGateway {
  const db = client as TrainingClient;
  return {
    listTrainingEditMetadata: async (teamId, eventIds) => {
      const data = await call(db, "list_team_training_edit_metadata", {
        p_team_id: teamId,
        p_event_ids: eventIds,
      });
      if (!Array.isArray(data)) {
        throw new ApplicationError("INTERNAL", trainingMessages.readFailed);
      }
      const mapped = data.map((row) => {
        const parsed = editMetadataRowSchema.safeParse(row);
        if (!parsed.success) {
          throw new ApplicationError("INTERNAL", trainingMessages.readFailed);
        }
        return parsed.data;
      });
      if (
        mapped.length !== eventIds.length ||
        new Set(mapped.map((item) => item.eventId)).size !== mapped.length
      ) {
        throw new ApplicationError("INTERNAL", trainingMessages.readFailed);
      }
      return mapped;
    },
    createTrainingSession: (command) => createSession(db, command),
    createTrainingSeries: (command) => createSeries(db, command),
    editTrainingOccurrence: (command) => editOccurrence(db, command),
    editTrainingFollowing: (command) => editFollowing(db, command),
    editTrainingSeries: (command) => editSeries(db, command),
    checkInTraining: (eventId) => checkIn(db, eventId),
  };
}

async function createSession(
  db: TrainingClient,
  command: TrainingSession,
): Promise<{ eventId: string }> {
  return {
    eventId: uuid(
      await call(db, "create_training_session", {
        p_club_id: command.clubId,
        p_team_id: command.teamId,
        p_starts_at: command.startsAt,
        p_ends_at: command.endsAt,
        p_court_label: command.courtLabel,
        p_lead_coach_user_id: command.leadCoachUserId,
      }),
      trainingMessages.saveFailed,
    ),
  };
}

async function createSeries(
  db: TrainingClient,
  command: TrainingSeries,
): Promise<{ seriesId: string }> {
  return {
    seriesId: uuid(
      await call(db, "create_training_series", {
        p_club_id: command.clubId,
        p_team_id: command.teamId,
        p_weekday: command.weekday,
        p_local_time: command.localTime,
        p_timezone: command.timezone,
        p_starts_on: command.startsOn,
        p_ends_on: command.endsOn,
        p_court_label: command.courtLabel,
        p_lead_coach_user_id: command.leadCoachUserId,
      }),
      trainingMessages.saveFailed,
    ),
  };
}

async function editOccurrence(
  db: TrainingClient,
  command: TrainingOccurrenceEdit,
): Promise<{ eventId: string }> {
  return {
    eventId: uuid(
      await call(db, "edit_training_occurrence", {
        p_event_id: command.eventId,
        p_starts_at: command.startsAt,
        p_ends_at: command.endsAt,
        p_court_label: command.courtLabel,
        p_lead_coach_user_id: command.leadCoachUserId,
      }),
      trainingMessages.saveFailed,
    ),
  };
}

async function editFollowing(
  db: TrainingClient,
  command: TrainingFollowingEdit,
): Promise<{ seriesId: string }> {
  return {
    seriesId: uuid(
      await call(db, "edit_training_following", {
        p_event_id: command.eventId,
        p_weekday: command.weekday,
        p_local_time: command.localTime,
        p_timezone: command.timezone,
        p_ends_on: command.endsOn,
      }),
      trainingMessages.saveFailed,
    ),
  };
}

async function editSeries(
  db: TrainingClient,
  command: TrainingSeriesEdit,
): Promise<{ seriesId: string }> {
  return {
    seriesId: uuid(
      await call(db, "edit_training_series", {
        p_series_id: command.seriesId,
        p_weekday: command.weekday,
        p_local_time: command.localTime,
        p_timezone: command.timezone,
        p_ends_on: command.endsOn,
      }),
      trainingMessages.saveFailed,
    ),
  };
}

async function checkIn(db: TrainingClient, eventId: string): Promise<void> {
  await call(db, "check_in_training", { p_event_id: eventId });
}

function uuid(data: unknown, message: string): string {
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", message);
  }
  return parsed.data;
}

async function call(
  db: TrainingClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    const code = OPERATION_CODE.exec(result.error.message)?.[1];
    if (code === "UNAUTHENTICATED") {
      throw new ApplicationError(
        "UNAUTHENTICATED",
        trainingMessages.unauthenticated,
      );
    }
    if (code === "FORBIDDEN") {
      throw new ApplicationError("FORBIDDEN", trainingMessages.forbidden);
    }
    if (code === "NOT_FOUND") {
      throw new ApplicationError("NOT_FOUND", trainingMessages.notFound);
    }
    if (code === "VALIDATION_FAILED") {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        trainingMessages.validationFailed,
      );
    }
    if (code === "CONFLICT") {
      throw new ApplicationError("CONFLICT", trainingMessages.conflict);
    }
    throw new ApplicationError("INTERNAL", trainingMessages.readFailed);
  }
  return result.data;
}
