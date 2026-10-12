import type { AuthSessionSnapshot } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useMemo, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createDeferredCallbackAuth,
  createMobileAuthActions,
  createMobileOtpClient,
} from "../src/auth/mobile-auth-actions";
import { MobileAuthGate } from "../src/auth/mobile-auth-gate";
import {
  enforcePendingPushCleanup,
  readPendingPushCleanupUsers,
  resumePushRegistration,
  suspendPushRegistration,
  tryRemovePushRegistrationOrRetainFence,
} from "../src/auth/pending-push-cleanup";
import type { PendingPushCleanupStore } from "../src/auth/pending-push-cleanup";
import {
  cleanPendingCallbackPushRegistration,
  clearSessionAfterCallbackTransitionFailure,
  removePreviousPushAfterSuccessfulAccountSwitch,
  tryRemoveCallbackPushRegistrationOrRetainFence,
} from "../src/auth/callback-push-cleanup";
import type { PreviousPushSession } from "../src/auth/callback-push-cleanup";
import {
  clearLiveMobileAuthSessionStorage,
  restoreLiveMobileAuthSession,
  signOutLiveMobileAuthSession,
} from "../src/auth-session";
import { loadMobileBootEnv } from "../src/boot-env";
import { loadMobileCurrentClubContext } from "../src/load-mobile-current-club-context";
import { GuardianHomeScreen } from "../src/guardian-home-screen";
import {
  acknowledgeMobileAnnouncement,
  loadMobileAnnouncements,
  markMobileAnnouncementRead,
} from "../src/load-mobile-announcements";
import {
  canReadMobileCoachGameDay,
  loadMobileGameDay,
} from "../src/load-mobile-game-day";
import {
  loadMobileFillIn,
  respondMobileFillIn,
} from "../src/load-mobile-fill-in";
import {
  acceptMobileDutySwap,
  acknowledgeMobileDuty,
  loadMobileOpenDutySwaps,
  requestMobileOpenDutySwap,
} from "../src/load-mobile-duties";
import { loadMobileRsvpChoices, saveMobileRsvp } from "../src/load-mobile-rsvp";
import {
  loadMobileNotificationPreferences,
  saveMobileNotificationPreference,
} from "../src/load-mobile-notifications";
import { loadMobileTeamRoster } from "../src/load-mobile-team-roster";
import { loadMobileTeamSchedule } from "../src/load-mobile-team-schedule";
import { MobileDestinations } from "../src/mobile-destinations";
import {
  MobilePushRegistrationLifecycle,
  removeLivePushRegistration,
  removeLivePushRegistrationForSession,
  requestLivePushRegistration,
} from "../src/expo-push-lifecycle";
import { ProfileScreen } from "../src/profile-screen";
import { expoNetworkMonitor } from "../src/expo-network-monitor";
import { secureGameDaySnapshotStore } from "../src/game-day-snapshot";
import {
  clearStoredOfflineGameDay,
  replaceOfflineContextPointer,
} from "../src/offline-context";
import { useMobileOnline } from "../src/mobile-connectivity";
import { TeamAnnouncementsScreen } from "../src/team-announcements-screen";
import { TeamGameDayScreen } from "../src/team-game-day-screen";
import { TeamRosterScreen } from "../src/team-roster-screen";
import { TeamScheduleScreen } from "../src/team-schedule-screen";
import {
  getMobileSessionStorage,
  mobileSupabasePublicConfig,
  getMobileSupabaseClient,
} from "../src/supabase-client";

const theme = themeFor("mustangs");
const boot = loadMobileBootEnv();
const pendingPushCleanupScope =
  new URL(boot.supabaseUrl).hostname.split(".")[0] ?? "invalid-project";
const pendingPushCleanupStore: PendingPushCleanupStore = {
  getItem: (key) =>
    SecureStore.getItemAsync(`${pendingPushCleanupScope}:${key}`),
  setItem: (key, value) =>
    SecureStore.setItemAsync(`${pendingPushCleanupScope}:${key}`, value),
  removeItem: (key) =>
    SecureStore.deleteItemAsync(`${pendingPushCleanupScope}:${key}`),
};

export default function CurrentClubContextRoute() {
  const queryClient = useQueryClient();
  const snapshotStore = useMemo(() => secureGameDaySnapshotStore(), []);
  const clearPrivateCache = useCallback(
    async (previousUserId: string | null) => {
      void queryClient.cancelQueries();
      queryClient.clear();
      if (previousUserId !== null) {
        await clearStoredOfflineGameDay(snapshotStore, previousUserId);
      }
    },
    [queryClient, snapshotStore],
  );
  const loadContext = useCallback(() => loadMobileCurrentClubContext(), []);
  const actions = useMemo(() => {
    const supabase = getMobileSupabaseClient();
    return createMobileAuthActions(
      createMobileOtpClient(supabase),
      boot.appEnv,
      createDeferredCallbackAuth(
        supabase,
        getMobileSessionStorage(),
        mobileSupabasePublicConfig(),
      ),
    );
  }, []);
  const monitor = useMemo(() => expoNetworkMonitor(), []);
  const online = useMobileOnline(monitor);
  const callbackSuspendedUserId = useRef<string | null>(null);
  const callbackPreviousSession = useRef<PreviousPushSession | null>(null);
  const restoreWithPushCleanupFence = useCallback(async () => {
    const restored = await restoreLiveMobileAuthSession();
    if (restored.state !== "authenticated") {
      return restored;
    }
    const restoredUserId = restored.principal.userId;
    let restoredSessionRejected = false;
    const rejectRestoredSession = async () => {
      if (restoredSessionRejected) return;
      restoredSessionRejected = true;
      try {
        await getMobileSupabaseClient().auth.signOut({ scope: "local" });
      } finally {
        try {
          await clearLiveMobileAuthSessionStorage();
        } finally {
          await clearStoredOfflineGameDay(snapshotStore, restoredUserId);
        }
      }
    };

    try {
      await enforcePendingPushCleanup({
        store: pendingPushCleanupStore,
        nextUserId: restoredUserId,
        removeRegistration: removeLivePushRegistration,
        rejectOtherAccount: rejectRestoredSession,
      });
      return restored;
    } catch {
      // Restoration does not pass through beforeAcceptAuthenticated. Apply
      // the same multi-account fence here and clear private offline data when
      // other unresolved endpoints prevent admission.
      await rejectRestoredSession();
      return { state: "unauthenticated" } as const;
    }
  }, [snapshotStore]);
  const linking = useMemo(
    () => ({
      getInitialUrl: () => Linking.getInitialURL(),
      subscribe(listener: (url: string) => void) {
        const subscription = Linking.addEventListener("url", (event) => {
          listener(event.url);
        });
        return () => {
          subscription.remove();
        };
      },
    }),
    [],
  );
  const clearPushRegistration = useCallback(async (userId: string) => {
    suspendPushRegistration(userId);
    // Mark before remote revocation so another session admission cannot race
    // an unresolved sign-out cleanup.
    await tryRemovePushRegistrationOrRetainFence({
      store: pendingPushCleanupStore,
      userId,
      removeRegistration: removeLivePushRegistration,
    });
  }, []);
  const clearFailedCallbackSession = useCallback(async () => {
    const previous = callbackPreviousSession.current;
    if (previous !== null) {
      suspendPushRegistration(previous.userId);
      try {
        await tryRemoveCallbackPushRegistrationOrRetainFence({
          store: pendingPushCleanupStore,
          previous,
          removeRegistration: removeLivePushRegistrationForSession,
        });
      } catch {
        // Local sign-out below still clears the failed callback session. The
        // push registration stays suspended for this process lifetime.
      } finally {
        callbackPreviousSession.current = null;
        callbackSuspendedUserId.current = null;
      }
    }
    await clearSessionAfterCallbackTransitionFailure(
      () => getMobileSupabaseClient().auth.signOut({ scope: "local" }),
      clearLiveMobileAuthSessionStorage,
    );
  }, []);
  const beforeCompleteCallback = useCallback(async () => {
    const { data, error } = await getMobileSupabaseClient().auth.getSession();
    if (error !== null) throw new Error("The session could not be read.");
    const previousSession = data.session;
    if (previousSession === null) {
      callbackPreviousSession.current = null;
      callbackSuspendedUserId.current = null;
      return undefined;
    }
    const previous = {
      userId: previousSession.user.id,
      accessToken: previousSession.access_token,
      refreshToken: previousSession.refresh_token,
    };
    callbackPreviousSession.current = previous;
    callbackSuspendedUserId.current = previous.userId;
    suspendPushRegistration(previous.userId);
    const cleanedPendingRegistration =
      await cleanPendingCallbackPushRegistration({
        store: pendingPushCleanupStore,
        userId: previous.userId,
        accessToken: previous.accessToken,
        refreshToken: previous.refreshToken,
        removeRegistration: removeLivePushRegistrationForSession,
      });
    // The callback must first be accepted by Supabase. An expired or forged
    // link must never delete the prior account's endpoint. Use the captured
    // previous session only if the successful callback switches accounts.
    return async (next: AuthSessionSnapshot) => {
      if (next.state !== "authenticated") {
        callbackSuspendedUserId.current = null;
        return;
      }
      if (next.principal.userId === previous.userId) {
        // Keep registration suspended until the exchanged Supabase session
        // has been committed. A failed commit is handled by the callback
        // cleanup hook, which revokes this user's endpoint and retains a
        // cleanup fence if revocation cannot be confirmed.
        return;
      }
      const removed = await removePreviousPushAfterSuccessfulAccountSwitch(
        pendingPushCleanupStore,
        previous,
        next.principal.userId,
        removeLivePushRegistrationForSession,
        cleanedPendingRegistration,
      );
      if (!removed) {
        throw new Error("The previous account push endpoint is unresolved.");
      }
      callbackSuspendedUserId.current = null;
      callbackPreviousSession.current = null;
    };
  }, []);
  const afterCallbackRestore = useCallback(
    async (restored: AuthSessionSnapshot) => {
      const suspendedUserId = callbackSuspendedUserId.current;
      callbackSuspendedUserId.current = null;
      if (
        suspendedUserId !== null &&
        restored.state === "authenticated" &&
        restored.principal.userId === suspendedUserId
      ) {
        resumePushRegistration(suspendedUserId);
        callbackPreviousSession.current = null;
      }
      callbackSuspendedUserId.current = null;
    },
    [],
  );

  const beforeAcceptAuthenticated = useCallback(
    async (next: AuthSessionSnapshot) => {
      if (next.state !== "authenticated") return;
      await enforcePendingPushCleanup({
        store: pendingPushCleanupStore,
        nextUserId: next.principal.userId,
        removeRegistration: removeLivePushRegistration,
        rejectOtherAccount: async () => {
          try {
            await getMobileSupabaseClient().auth.signOut({ scope: "local" });
          } finally {
            await clearLiveMobileAuthSessionStorage();
          }
        },
      });
      if (callbackSuspendedUserId.current === next.principal.userId) {
        resumePushRegistration(next.principal.userId);
        callbackSuspendedUserId.current = null;
        callbackPreviousSession.current = null;
      }
    },
    [],
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.color.background.canvas }}
    >
      <MobileAuthGate
        restore={restoreWithPushCleanupFence}
        signOut={async (userId) => {
          const next = await signOutLiveMobileAuthSession(
            clearPushRegistration,
          );
          if (next.state === "recovery") {
            try {
              if (
                (await readPendingPushCleanupUsers(pendingPushCleanupStore))
                  .length === 0
              ) {
                resumePushRegistration(userId);
              }
            } catch {
              // Keep push registration suspended when the cleanup state is unknown.
            }
          }
          return next;
        }}
        actions={actions}
        beforeCompleteCallback={beforeCompleteCallback}
        afterCallbackRestore={afterCallbackRestore}
        beforeAcceptAuthenticated={beforeAcceptAuthenticated}
        clearFailedCallbackSession={clearFailedCallbackSession}
        linking={linking}
        clearPrivateCache={clearPrivateCache}
        authenticated={(userId) => (
          <>
            <MobilePushRegistrationLifecycle
              userId={userId}
              store={pendingPushCleanupStore}
            />
            <MobileDestinations
              loadContext={loadContext}
              onTeamSelected={(teamId) =>
                replaceOfflineContextPointer(snapshotStore, {
                  version: 1,
                  userId,
                  teamId,
                })
              }
              home={(navigate, scopedLoadContext) => (
                <GuardianHomeScreen
                  loadContext={scopedLoadContext}
                  loadSchedule={loadMobileTeamSchedule}
                  loadGameDay={loadMobileGameDay}
                  loadAnnouncements={loadMobileAnnouncements}
                  onOpenSchedule={() => navigate("Schedule")}
                  onOpenGameDay={() => navigate("Schedule")}
                  onOpenUpdates={() => navigate("Updates")}
                />
              )}
              schedule={(scopedLoadContext, selectedTeamId) => (
                <>
                  <TeamGameDayScreen
                    loadContext={scopedLoadContext}
                    selectedTeamId={selectedTeamId}
                    loadGameDay={loadMobileGameDay}
                    canReadCoachGameDay={canReadMobileCoachGameDay}
                    loadRsvpChoices={loadMobileRsvpChoices}
                    saveRsvp={saveMobileRsvp}
                    loadFillInOptions={loadMobileFillIn}
                    respondFillIn={respondMobileFillIn}
                    loadDutySwaps={(teamId, eventId) =>
                      loadMobileOpenDutySwaps({ teamId, eventId })
                    }
                    acknowledgeDuty={acknowledgeMobileDuty}
                    requestDutySwap={requestMobileOpenDutySwap}
                    acceptDutySwap={acceptMobileDutySwap}
                    snapshotStore={snapshotStore}
                    localUserId={userId}
                    online={online}
                  />
                  <TeamScheduleScreen
                    loadContext={scopedLoadContext}
                    loadSchedule={loadMobileTeamSchedule}
                  />
                </>
              )}
              team={(scopedLoadContext) => (
                <TeamRosterScreen
                  loadContext={scopedLoadContext}
                  loadRoster={loadMobileTeamRoster}
                />
              )}
              updates={(scopedLoadContext) => (
                <TeamAnnouncementsScreen
                  loadContext={scopedLoadContext}
                  loadAnnouncements={loadMobileAnnouncements}
                  acknowledge={acknowledgeMobileAnnouncement}
                  markRead={markMobileAnnouncementRead}
                />
              )}
              profile={(scopedLoadContext) => (
                <ProfileScreen
                  loadContext={scopedLoadContext}
                  loadPreferences={loadMobileNotificationPreferences}
                  savePreference={saveMobileNotificationPreference}
                  requestPush={() =>
                    requestLivePushRegistration(userId, pendingPushCleanupStore)
                  }
                />
              )}
            />
          </>
        )}
      />
    </SafeAreaView>
  );
}
