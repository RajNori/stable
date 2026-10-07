"use server";

import {
  DEVICE_PLATFORMS,
  NOTIFICATION_TYPES,
  createSupabaseNotificationGateway,
  notificationMessages,
  registerDevice,
  setNotificationPreference,
  type NotificationPreference,
} from "@stable/notifications";
import { redirect } from "next/navigation";

import { principalFromSupabase } from "../../lib/principal";
import { createSupabaseServerClient } from "../../lib/supabase/server";

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function destination(): string {
  return "/notifications";
}

function withError(message: string): string {
  return `${destination()}?error=${encodeURIComponent(message)}`;
}

function isPlatform(value: string): value is (typeof DEVICE_PLATFORMS)[number] {
  return DEVICE_PLATFORMS.some((item) => item === value);
}

async function loadWriter() {
  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  if (principal === null) {
    return null;
  }
  return {
    principal,
    writer: createSupabaseNotificationGateway(supabase),
  };
}

export async function registerDeviceAction(formData: FormData): Promise<void> {
  const token = text(formData, "token");
  const platform = text(formData, "platform");
  if (token === null || platform === null || !isPlatform(platform)) {
    redirect(withError(notificationMessages.validationFailed));
  }

  const loaded = await loadWriter();
  if (loaded === null) {
    redirect(withError(notificationMessages.unauthenticated));
  }

  try {
    await registerDevice({
      principal: loaded.principal,
      token,
      platform,
      writer: loaded.writer,
    });
  } catch (caught: unknown) {
    const message =
      caught instanceof Error
        ? caught.message
        : notificationMessages.saveFailed;
    redirect(withError(message));
  }

  redirect(destination());
}

export async function saveNotificationPreferencesAction(
  formData: FormData,
): Promise<void> {
  const loaded = await loadWriter();
  if (loaded === null) {
    redirect(withError(notificationMessages.unauthenticated));
  }

  try {
    for (const category of NOTIFICATION_TYPES) {
      const preference: NotificationPreference = {
        category,
        pushEnabled: formData.get(category) === "on",
      };
      await setNotificationPreference({
        principal: loaded.principal,
        category: preference.category,
        pushEnabled: preference.pushEnabled,
        writer: loaded.writer,
      });
    }
  } catch (caught: unknown) {
    const message =
      caught instanceof Error
        ? caught.message
        : notificationMessages.saveFailed;
    redirect(withError(message));
  }

  redirect(destination());
}
