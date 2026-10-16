import { configureObservability, safeSentryEvent } from "@stable/observability";

export async function register(): Promise<void> {
  const { loadWebBootEnv } = await import("./lib/boot-env.server");
  const boot = loadWebBootEnv();
  if (boot.sentryDsn === undefined) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");
  const release = process.env.NEXT_PUBLIC_APP_RELEASE;
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
