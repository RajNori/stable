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

const SENSITIVE_KEYS = new Set(
  SENSITIVE_METADATA_FIELDS.map((field) => field.toLowerCase()),
);
const MAX_MESSAGE_LENGTH = 300;
const MAX_DEPTH = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeName(value: string): string {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(value) ? value : "Error";
}

function replaceLiteral(haystack: string, needle: string): string {
  if (needle.length === 0 || !haystack.includes(needle)) {
    return haystack;
  }
  return haystack.split(needle).join("[redacted]");
}

function redactText(
  message: string,
  sensitiveValues: readonly string[],
): string {
  let redacted = message;
  const literals = [...sensitiveValues]
    .filter((value) => value.length > 0)
    .sort((left, right) => right.length - left.length);
  for (const value of literals) {
    redacted = replaceLiteral(redacted, value);
  }

  redacted = redacted
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted]")
    .replace(/\+\d{8,15}\b/g, "[redacted]")
    .replace(/\botp\b\s*[:=]?\s*\d{4,8}\b/gi, "otp [redacted]");

  return redacted.length > MAX_MESSAGE_LENGTH
    ? redacted.slice(0, MAX_MESSAGE_LENGTH)
    : redacted;
}

function collectSensitive(
  value: unknown,
  found: string[],
  seen: WeakSet<object>,
  depth: number,
): void {
  if (depth > MAX_DEPTH || !isRecord(value) || seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSensitive(item, found, seen, depth + 1);
    }
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) && typeof nested === "string") {
      found.push(nested);
      continue;
    }
    collectSensitive(nested, found, seen, depth + 1);
  }

  if ("cause" in value) {
    collectSensitive(value.cause, found, seen, depth + 1);
  }
}

function classificationOf(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.code;
  }
  if (error instanceof Error) {
    return safeName(error.name);
  }
  return "unknown";
}

function messageOf(error: unknown): string {
  if (error instanceof Error || isRecord(error)) {
    return typeof error.message === "string" ? error.message : "Unavailable";
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unavailable";
}

export function normalizeException(
  error: unknown,
  stack: WeakSet<object> = new WeakSet(),
): SafeException {
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

  const sensitiveValues: string[] = [];
  collectSensitive(error, sensitiveValues, new WeakSet(), 0);
  const safe: SafeException = {
    name: error instanceof Error ? safeName(error.name) : "Error",
    classification: classificationOf(error),
    message: redactText(messageOf(error), sensitiveValues),
  };

  if (isRecord(error) && error.cause !== undefined) {
    safe.cause = normalizeException(error.cause, stack);
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
