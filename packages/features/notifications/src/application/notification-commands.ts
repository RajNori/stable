import { ApplicationError, type Principal } from "@stable/contracts";
import { z } from "zod";

import {
  DEVICE_PLATFORMS,
  NOTIFICATION_TYPES,
  notificationMessages,
} from "./notification-messages.js";

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

const tokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !hasControlCharacter(value));

export const registerDeviceSchema = z.strictObject({
  token: tokenSchema,
  platform: z.enum(DEVICE_PLATFORMS),
});

export const preferenceSchema = z.strictObject({
  category: z.enum(NOTIFICATION_TYPES),
  pushEnabled: z.boolean(),
});

export type NotificationPreference = {
  category: (typeof NOTIFICATION_TYPES)[number];
  pushEnabled: boolean;
};

export type NotificationWriter = {
  registerDevice(input: {
    token: string;
    platform: (typeof DEVICE_PLATFORMS)[number];
  }): Promise<{ endpointId: string }>;
  deactivateDevice(token: string): Promise<void>;
  setPreference(input: NotificationPreference): Promise<void>;
  listPreferences(): Promise<NotificationPreference[]>;
  enqueueAnnouncementPublished(announcementId: string): Promise<number>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    notificationMessages.validationFailed,
  );
}

function assertSignedIn(principal: Principal | null): void {
  if (principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      notificationMessages.unauthenticated,
    );
  }
}

export async function registerDevice(input: {
  principal: Principal | null;
  token: string;
  platform: string;
  writer: NotificationWriter;
}): Promise<{ endpointId: string }> {
  assertSignedIn(input.principal);
  const command = registerDeviceSchema.safeParse({
    token: input.token,
    platform: input.platform,
  });
  if (!command.success) {
    validationFailed();
  }
  return input.writer.registerDevice(command.data);
}

export async function deactivateDevice(input: {
  principal: Principal | null;
  token: string;
  writer: NotificationWriter;
}): Promise<void> {
  assertSignedIn(input.principal);
  const token = tokenSchema.safeParse(input.token);
  if (!token.success) {
    validationFailed();
  }
  await input.writer.deactivateDevice(token.data);
}

export async function setNotificationPreference(input: {
  principal: Principal | null;
  category: string;
  pushEnabled: boolean;
  writer: NotificationWriter;
}): Promise<void> {
  assertSignedIn(input.principal);
  const command = preferenceSchema.safeParse({
    category: input.category,
    pushEnabled: input.pushEnabled,
  });
  if (!command.success) {
    validationFailed();
  }
  await input.writer.setPreference(command.data);
}

export async function enqueueAnnouncementPublished(input: {
  principal: Principal | null;
  announcementId: string;
  writer: NotificationWriter;
}): Promise<number> {
  assertSignedIn(input.principal);
  const announcementId = idSchema.safeParse(input.announcementId);
  if (!announcementId.success) {
    validationFailed();
  }
  return input.writer.enqueueAnnouncementPublished(announcementId.data);
}
