import * as Sentry from "@sentry/nextjs";
import { configureObservability, safeSentryEvent } from "@stable/observability";

import { readPublicWebObservabilityConfig } from "./lib/public-supabase-env";

const boot = readPublicWebObservabilityConfig();
const release = process.env.NEXT_PUBLIC_APP_RELEASE;

if (boot.sentryDsn !== undefined) {
  Sentry.init({
    dsn: boot.sentryDsn,
    environment: boot.appEnv,
    ...(release === undefined ? {} : { release }),
    attachStacktrace: false,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    beforeSend(event) {
      return safeSentryEvent(event, {
        environment: boot.appEnv,
        runtime: "web",
        ...(release === undefined ? {} : { release }),
      });
    },
  });
  configureObservability({
    sentryDsn: boot.sentryDsn,
    exceptionSink: (error) => Sentry.captureException(error),
  });
}
