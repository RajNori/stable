import { configureObservability, safeSentryEvent } from "@stable/observability";
import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { bindMobileAuthRefreshLifecycle } from "../src/auth-refresh-lifecycle";
import { loadMobileBootEnv } from "../src/boot-env";
import { getMobileSupabaseClient } from "../src/supabase-client";

const boot = loadMobileBootEnv();
const release = process.env.EXPO_PUBLIC_APP_RELEASE;
if (boot.sentryDsn !== undefined) {
  Sentry.init({
    dsn: boot.sentryDsn,
    environment: boot.appEnv,
    ...(release === undefined ? {} : { release }),
    attachStacktrace: false,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    beforeSend(event) {
      return safeSentryEvent(event, {
        environment: boot.appEnv,
        runtime: "mobile",
        ...(release === undefined ? {} : { release }),
      });
    },
  });
  configureObservability({
    sentryDsn: boot.sentryDsn,
    exceptionSink: (error) => Sentry.captureException(error),
  });
}

bindMobileAuthRefreshLifecycle({
  appState: AppState,
  client: getMobileSupabaseClient(),
});

function RootLayout() {
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

export default boot.sentryDsn === undefined
  ? RootLayout
  : Sentry.wrap(RootLayout);
