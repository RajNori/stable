import { themeFor } from "@stable/design-tokens";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import React, { useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createMobileAuthActions,
  createMobileOtpClient,
} from "../src/auth/mobile-auth-actions";
import { MobileAuthGate } from "../src/auth/mobile-auth-gate";
import {
  clearSessionAfterCallbackTransitionFailure,
  cleanupPushAfterSuccessfulCallback,
} from "../src/auth/callback-push-cleanup";
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
import { getMobileSupabaseClient } from "../src/supabase-client";

const theme = themeFor("mustangs");
const boot = loadMobileBootEnv();

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
  const actions = useMemo(
    () =>
      createMobileAuthActions(
        createMobileOtpClient(getMobileSupabaseClient()),
        boot.appEnv,
      ),
    [],
  );
  const monitor = useMemo(() => expoNetworkMonitor(), []);
  const online = useMobileOnline(monitor);
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
  const clearPushRegistration = useCallback(
    async (userId: string) => removeLivePushRegistration(userId),
    [],
  );
  const clearFailedCallbackSession = useCallback(
    async () =>
      clearSessionAfterCallbackTransitionFailure(
        () => getMobileSupabaseClient().auth.signOut({ scope: "local" }),
        clearLiveMobileAuthSessionStorage,
      ),
    [],
  );
  const beforeCompleteCallback = useCallback(async () => {
    const { data, error } = await getMobileSupabaseClient().auth.getSession();
    if (error !== null) throw new Error("The session could not be read.");
    const previousSession = data.session;
    if (previousSession === null) return undefined;
    return cleanupPushAfterSuccessfulCallback(
      {
        userId: previousSession.user.id,
        accessToken: previousSession.access_token,
        refreshToken: previousSession.refresh_token,
      },
      async (userId, accessToken, refreshToken) => {
        try {
          await removeLivePushRegistrationForSession(
            userId,
            accessToken,
            refreshToken,
          );
        } catch {
          await clearFailedCallbackSession();
          throw new Error("The account switch could not be completed safely.");
        }
      },
    );
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.color.background.canvas }}
    >
      <MobileAuthGate
        restore={restoreLiveMobileAuthSession}
        signOut={() => signOutLiveMobileAuthSession(clearPushRegistration)}
        actions={actions}
        beforeCompleteCallback={beforeCompleteCallback}
        clearFailedCallbackSession={clearFailedCallbackSession}
        linking={linking}
        clearPrivateCache={clearPrivateCache}
        authenticated={(userId) => (
          <>
            <MobilePushRegistrationLifecycle userId={userId} />
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
                  requestPush={() => requestLivePushRegistration(userId)}
                />
              )}
            />
          </>
        )}
      />
    </SafeAreaView>
  );
}
