import { themeFor } from "@stable/design-tokens";
import * as Linking from "expo-linking";
import React, { useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createMobileAuthActions,
  createMobileOtpClient,
} from "../src/auth/mobile-auth-actions";
import { MobileAuthGate } from "../src/auth/mobile-auth-gate";
import {
  restoreLiveMobileAuthSession,
  signOutLiveMobileAuthSession,
} from "../src/auth-session";
import { loadMobileBootEnv } from "../src/boot-env";
import { CurrentClubContextScreen } from "../src/current-club-context-screen";
import { loadMobileCurrentClubContext } from "../src/load-mobile-current-club-context";
import { loadMobileGameDay } from "../src/load-mobile-game-day";
import { loadMobileTeamRoster } from "../src/load-mobile-team-roster";
import { loadMobileTeamSchedule } from "../src/load-mobile-team-schedule";
import { MobileDestinations } from "../src/mobile-destinations";
import { secureGameDaySnapshotStore } from "../src/game-day-snapshot";
import { TeamGameDayScreen } from "../src/team-game-day-screen";
import { TeamRosterScreen } from "../src/team-roster-screen";
import { TeamScheduleScreen } from "../src/team-schedule-screen";
import { getMobileSupabaseClient } from "../src/supabase-client";

const theme = themeFor("mustangs");
const boot = loadMobileBootEnv();

export default function CurrentClubContextRoute() {
  const loadContext = useCallback(() => loadMobileCurrentClubContext(), []);
  const actions = useMemo(
    () =>
      createMobileAuthActions(
        createMobileOtpClient(getMobileSupabaseClient()),
        boot.appEnv,
      ),
    [],
  );
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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.color.background.canvas }}
    >
      <MobileAuthGate
        restore={restoreLiveMobileAuthSession}
        signOut={signOutLiveMobileAuthSession}
        actions={actions}
        linking={linking}
        authenticated={() => (
          <MobileDestinations
            home={<CurrentClubContextScreen loadContext={loadContext} />}
            schedule={
              <>
                <TeamGameDayScreen
                  loadContext={loadContext}
                  loadGameDay={loadMobileGameDay}
                  snapshotStore={secureGameDaySnapshotStore()}
                />
                <TeamScheduleScreen
                  loadContext={loadContext}
                  loadSchedule={loadMobileTeamSchedule}
                />
              </>
            }
            team={
              <TeamRosterScreen
                loadContext={loadContext}
                loadRoster={loadMobileTeamRoster}
              />
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
