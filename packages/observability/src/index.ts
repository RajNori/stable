export {
  captureException,
  captureProductEvent,
  configureObservability,
} from "./capture.js";
export type {
  ExceptionSink,
  ObservabilityConfig,
  ProductEventSink,
} from "./capture.js";

export { SENSITIVE_METADATA_FIELDS } from "@stable/contracts";
export type {
  ProductEventMetadata,
  SensitiveMetadataField,
} from "@stable/contracts";
