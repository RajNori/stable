import {
  NOTIFICATION_TYPES,
  createSupabaseNotificationGateway,
  notificationMessages,
} from "@stable/notifications";

import { ClubAdminShell } from "../../components/club-admin-shell";
import { NotificationsPanel } from "../../components/notifications-panel";
import { loadLiveClubContext } from "../../lib/load-live-club-context";
import { principalFromSupabase } from "../../lib/principal";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  registerDeviceAction,
  saveNotificationPreferencesAction,
} from "./actions";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const visibleErrors = new Set<string>(Object.values(notificationMessages));

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const query = await searchParams;
  const queryError = query["error"];
  const requestedError = Array.isArray(queryError) ? queryError[0] : queryError;
  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return <ClubAdminShell presentation={presentation} />;
  }

  const supabase = await createSupabaseServerClient();
  const principal = await principalFromSupabase(supabase);
  if (principal === null) {
    return <ClubAdminShell presentation={presentation} />;
  }

  let error =
    requestedError !== undefined && visibleErrors.has(requestedError)
      ? requestedError
      : undefined;
  const enabled = new Map<string, boolean>();
  try {
    const preferences =
      await createSupabaseNotificationGateway(supabase).listPreferences();
    for (const preference of preferences) {
      enabled.set(preference.category, preference.pushEnabled);
    }
  } catch (caught: unknown) {
    error =
      caught instanceof Error
        ? caught.message
        : notificationMessages.readFailed;
  }

  return (
    <ClubAdminShell presentation={presentation}>
      <NotificationsPanel
        categories={NOTIFICATION_TYPES.map((category) => ({
          category,
          pushEnabled: enabled.get(category) ?? true,
        }))}
        {...(error === undefined ? {} : { error })}
        registerDevice={registerDeviceAction}
        savePreferences={saveNotificationPreferencesAction}
      />
    </ClubAdminShell>
  );
}
