import { themeFor } from "@stable/design-tokens";
import React, { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { CurrentClubContextScreen } from "../src/current-club-context-screen";
import { loadMobileCurrentClubContext } from "../src/load-mobile-current-club-context";

const theme = themeFor("mustangs");

export default function CurrentClubContextRoute() {
  const loadContext = useCallback(() => loadMobileCurrentClubContext(), []);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.color.background.canvas,
      }}
    >
      <CurrentClubContextScreen loadContext={loadContext} />
    </SafeAreaView>
  );
}
