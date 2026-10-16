import { ApplicationError, SENSITIVE_METADATA_FIELDS } from "@stable/contracts";
import type { ProductEventMetadata } from "@stable/contracts";

export type SafeException = {
  name: string;
  classification: string;
  message: string;
  cause?: SafeException;
};

export type ExceptionSink = (error: SafeException) => void;

export type ProductEventSink = (
  name: string,
  metadata: ProductEventMetadata,
) => void;

export type ObservabilityConfig = {
  sentryDsn?: string;
  posthogKey?: string;
  exceptionSink?: ExceptionSink;
  productEventSink?: ProductEventSink;
};

type ObservabilityState = {
  sentryDsn: string | undefined;
  posthogKey: string | undefined;
  exceptionSink: ExceptionSink | undefined;
  productEventSink: ProductEventSink | undefined;
};

const state: ObservabilityState = {
  sentryDsn: undefined,
  posthogKey: undefined,
  exceptionSink: undefined,
  productEventSink: undefined,
};

const MAX_CAUSE_DEPTH = 6;
const SENSITIVE_KEYS = new Set(
  SENSITIVE_METADATA_FIELDS.map((field) => field.toLowerCase()),
);

function configuredValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function configureObservability(config: ObservabilityConfig): void {
  state.sentryDsn = configuredValue(config.sentryDsn);
  state.posthogKey = configuredValue(config.posthogKey);
  state.exceptionSink = config.exceptionSink;
  state.productEventSink = config.productEventSink;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeMessage(): string {
  // Error messages frequently contain server response bodies, names, notes,
  // URLs, or provider data. Pattern-based redaction cannot reliably identify
  // all child or coaching data, so only a constant message crosses this sink.
  return "An application error occurred.";
}

function classificationOf(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.code;
  }
  if (error instanceof Error) {
    return "Error";
  }
  return "unknown";
}

export function normalizeException(
  error: unknown,
  stack: WeakSet<object> = new WeakSet(),
  depth = 0,
): SafeException {
  if (depth > MAX_CAUSE_DEPTH) {
    return { name: "Error", classification: "unknown", message: "[redacted]" };
  }
  if (isRecord(error)) {
    if (stack.has(error)) {
      return {
        name: "Error",
        classification: "unknown",
        message: "[redacted]",
      };
    }
    stack.add(error);
  }

  const safe: SafeException = {
    name: error instanceof ApplicationError ? "ApplicationError" : "Error",
    classification: classificationOf(error),
    message: safeMessage(),
  };

  if (isRecord(error) && error.cause !== undefined) {
    safe.cause = normalizeException(error.cause, stack, depth + 1);
  }

  return safe;
}

export function captureException(error: unknown): void {
  try {
    if (state.sentryDsn === undefined) {
      return;
    }

    const sink = state.exceptionSink;
    if (sink === undefined) {
      return;
    }

    sink(normalizeException(error));
  } catch {
    return;
  }
}

function isProductEventKey(key: string): key is keyof ProductEventMetadata {
  return (
    key === "teamId" ||
    key === "eventId" ||
    key === "clubId" ||
    key === "userId"
  );
}

function isSafeProductMetadata(value: unknown): value is ProductEventMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== "string" || SENSITIVE_KEYS.has(key.toLowerCase())) {
      return false;
    }
    if (!isProductEventKey(key) || typeof record[key] !== "string") {
      return false;
    }
  }

  return true;
}

export function captureProductEvent(
  name: string,
  metadata: ProductEventMetadata,
): void {
  try {
    if (!isSafeProductMetadata(metadata)) {
      return;
    }
    if (state.posthogKey === undefined) {
      return;
    }

    const sink = state.productEventSink;
    if (sink === undefined) {
      return;
    }

    sink(name, metadata);
  } catch {
    return;
  }
}
