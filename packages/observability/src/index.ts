export {
  captureException,
  captureProductEvent,
  configureObservability,
} from "./capture.js";
export {
  safeSentryEvent,
  type SafeSentryEvent,
  type SafeSentryEventContext,
} from "./sentry-event.js";
export type {
  ExceptionSink,
  ObservabilityConfig,
  ProductEventSink,
  SafeException,
} from "./capture.js";

export { SENSITIVE_METADATA_FIELDS } from "@stable/contracts";
export type {
  ProductEventMetadata,
  SensitiveMetadataField,
} from "@stable/contracts";
