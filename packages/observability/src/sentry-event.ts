export type SafeSentryEventContext = {
  readonly environment: "local" | "staging" | "production";
  readonly runtime: "web" | "mobile";
  readonly release?: string;
};

export type SafeSentryEvent = {
  readonly event_id?: string;
  readonly type: undefined;
  readonly platform: "javascript";
  readonly level: "error";
  readonly message: "An application error occurred.";
  readonly exception: {
    values: {
      type: "Error";
      value: "An application error occurred.";
    }[];
  };
  readonly environment: SafeSentryEventContext["environment"];
  readonly release?: string;
  readonly fingerprint: string[];
  readonly tags: {
    readonly application: "the-stable";
    readonly runtime: SafeSentryEventContext["runtime"];
  };
};

/**
 * Build a deliberately small Sentry event. SDK-captured requests, breadcrumbs,
 * user context, stack frames, exception text, and arbitrary metadata are all
 * discarded because they may contain child, guardian, or coaching data.
 */
export function safeSentryEvent(
  event: unknown,
  context: SafeSentryEventContext,
): SafeSentryEvent {
  const candidateId = readEventId(event);
  const safeRelease = safeReleaseValue(context.release);

  return {
    ...(candidateId === undefined ? {} : { event_id: candidateId }),
    type: undefined,
    platform: "javascript",
    level: "error",
    message: "An application error occurred.",
    exception: {
      values: [
        {
          type: "Error",
          value: "An application error occurred.",
        },
      ],
    },
    environment: context.environment,
    ...(safeRelease === undefined ? {} : { release: safeRelease }),
    fingerprint: ["the-stable", "application-error"],
    tags: {
      application: "the-stable",
      runtime: context.runtime,
    },
  };
}

function readEventId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("event_id" in value)) {
    return undefined;
  }
  const id: unknown = value.event_id;
  return typeof id === "string" && /^[0-9a-f]{32}$/iu.test(id) ? id : undefined;
}

function safeReleaseValue(value: string | undefined): string | undefined {
  // Release metadata is only useful here as a source commit identifier. Do
  // not accept free-form labels that could contain names or other user data.
  if (value === undefined || !/^[0-9a-f]{7,40}$/iu.test(value)) {
    return undefined;
  }
  return value;
}
