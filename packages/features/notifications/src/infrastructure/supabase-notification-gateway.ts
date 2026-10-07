import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import type { NotificationWriter } from "../application/notification-commands.js";
import {
  NOTIFICATION_TYPES,
  notificationMessages,
} from "../application/notification-messages.js";

type QueryError = Pick<PostgrestError, "message">;
type QueryResult = { data: unknown; error: QueryError | null };
type NotificationClient = {
  rpc(name: string, args?: Record<string, unknown>): Promise<QueryResult>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|CONFLICT)$/;

const preferenceRow = z.strictObject({
  category: z.enum(NOTIFICATION_TYPES),
  push_enabled: z.boolean(),
});

export function createSupabaseNotificationGateway(
  client: unknown,
): NotificationWriter {
  const db = client as NotificationClient;
  return {
    registerDevice: async (input) => ({
      endpointId: uuid(
        await call(db, "register_device_endpoint", {
          p_token: input.token,
          p_platform: input.platform,
        }),
      ),
    }),
    deactivateDevice: async (token) => {
      await call(db, "deactivate_device_endpoint", { p_token: token });
    },
    setPreference: async (input) => {
      await call(db, "set_notification_preference", {
        p_category: input.category,
        p_push_enabled: input.pushEnabled,
      });
    },
    listPreferences: async () => {
      const data = await call(db, "list_notification_preferences");
      const rows = z.array(preferenceRow).safeParse(data ?? []);
      if (!rows.success) {
        throw new ApplicationError("INTERNAL", notificationMessages.readFailed);
      }
      return rows.data.map((row) => ({
        category: row.category,
        pushEnabled: row.push_enabled,
      }));
    },
    enqueueAnnouncementPublished: async (announcementId) => {
      const count = z
        .number()
        .int()
        .nonnegative()
        .safeParse(
          await call(db, "enqueue_announcement_published", {
            p_announcement_id: announcementId,
          }),
        );
      if (!count.success) {
        throw new ApplicationError("INTERNAL", notificationMessages.saveFailed);
      }
      return count.data;
    },
  };
}

function uuid(value: unknown): string {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", notificationMessages.saveFailed);
  }
  return parsed.data;
}

async function call(
  db: NotificationClient,
  name: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    const code = OPERATION_CODE.exec(result.error.message)?.[1];
    if (code === "UNAUTHENTICATED") {
      throw new ApplicationError(
        "UNAUTHENTICATED",
        notificationMessages.unauthenticated,
      );
    }
    if (code === "FORBIDDEN") {
      throw new ApplicationError("FORBIDDEN", notificationMessages.forbidden);
    }
    if (code === "NOT_FOUND") {
      throw new ApplicationError("NOT_FOUND", notificationMessages.notFound);
    }
    if (code === "VALIDATION_FAILED") {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        notificationMessages.validationFailed,
      );
    }
    if (code === "CONFLICT") {
      throw new ApplicationError("CONFLICT", notificationMessages.conflict);
    }
    throw new ApplicationError("INTERNAL", notificationMessages.readFailed);
  }
  return result.data;
}
