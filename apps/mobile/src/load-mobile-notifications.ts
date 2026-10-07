import { principalFromSession } from "@stable/auth";
import { ApplicationError } from "@stable/contracts";
import {
  createSupabaseNotificationGateway,
  deactivateDevice,
  notificationMessages,
  registerDevice,
} from "@stable/notifications";
import type { User } from "@supabase/supabase-js";

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

export async function registerMobileDevice(token: string): Promise<void> {
  const loaded = await signedIn();
  await registerDevice({
    principal: loaded.principal,
    token,
    platform: "IOS",
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
