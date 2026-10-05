import { SENSITIVE_METADATA_FIELDS } from "@stable/contracts";
import type { ProductEventMetadata } from "@stable/contracts";

export type ExceptionSink = (error: unknown) => void;

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

export function captureException(error: unknown): void {
  try {
    if (state.sentryDsn === undefined) {
      return;
    }

    const sink = state.exceptionSink;
    if (sink === undefined) {
      return;
    }

    sink(error);
  } catch {
    return;
  }
}

function isSafeProductMetadata(value: unknown): value is ProductEventMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return !SENSITIVE_METADATA_FIELDS.some((field) =>
    Object.hasOwn(value, field),
  );
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
