import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { bindMobileAuthRefreshLifecycle } from "../src/auth-refresh-lifecycle";
import { loadMobileBootEnv } from "../src/boot-env";
import { getMobileSupabaseClient } from "../src/supabase-client";

loadMobileBootEnv();
bindMobileAuthRefreshLifecycle({
  appState: AppState,
  client: getMobileSupabaseClient(),
});

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Slot />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
