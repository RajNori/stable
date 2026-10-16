import { principalFromSession } from "@stable/auth";
import { ENV } from "@stable/config";
import { ApplicationError } from "@stable/contracts";
import {
  createSupabaseNotificationGateway,
  deactivateDevice,
  setNotificationPreference,
  type NotificationPreference,
  notificationMessages,
  registerDevice,
} from "@stable/notifications";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

import { getMobileSupabaseClient } from "./supabase-client";

function readDisplayName(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }

  const value = Object.getOwnPropertyDescriptor(
    metadata,
    "display_name",
  )?.value;
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

function sessionIdentityFromUser(user: User): {
  id: string;
  displayName?: string;
} {
  const displayName = readDisplayName(user.user_metadata);
  if (displayName === undefined) {
    return { id: user.id };
  }

  return { id: user.id, displayName };
}

async function signedIn() {
  const client = getMobileSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error !== null) {
    throw new Error("The session could not be read.");
  }
  const user = data.session?.user;
  const principal = principalFromSession(
    user === undefined ? null : sessionIdentityFromUser(user),
  );
  if (principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      notificationMessages.unauthenticated,
    );
  }
  return {
    principal,
    writer: createSupabaseNotificationGateway(client),
  };
}

export async function registerMobileDevice(
  token: string,
  platform: "IOS" | "ANDROID",
): Promise<void> {
  const loaded = await signedIn();
  await registerDevice({
    principal: loaded.principal,
    token,
    platform,
    writer: loaded.writer,
  });
}

export async function removeMobileDevice(token: string): Promise<void> {
  const loaded = await signedIn();
  await deactivateDevice({
    principal: loaded.principal,
    token,
    writer: loaded.writer,
  });
}

export async function removeMobileDeviceForSession(
  token: string,
  session: { accessToken: string; refreshToken: string },
): Promise<void> {
  const url = process.env[ENV.expoSupabaseUrl];
  const key = process.env[ENV.expoSupabasePublishableKey];
  if (!url || !key) throw new Error("Mobile Supabase configuration required.");
  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await client.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });
  if (error !== null) throw new Error("The previous session is unavailable.");
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError !== null || data.session === null) {
    throw new Error("The previous session is unavailable.");
  }
  try {
    await deactivateDevice({
      principal: principalFromSession(
        sessionIdentityFromUser(data.session.user),
      ),
      token,
      writer: createSupabaseNotificationGateway(client),
    });
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}

export async function loadMobileNotificationPreferences(): Promise<
  NotificationPreference[]
> {
  const loaded = await signedIn();
  return loaded.writer.listPreferences();
}

export async function saveMobileNotificationPreference(
  preference: NotificationPreference,
): Promise<void> {
  const loaded = await signedIn();
  await setNotificationPreference({
    principal: loaded.principal,
    ...preference,
    writer: loaded.writer,
  });
}
