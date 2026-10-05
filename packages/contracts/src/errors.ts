import { z } from "zod";

export const APPLICATION_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "STALE_WRITE",
  "UPSTREAM_UNAVAILABLE",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export const applicationErrorCodeSchema = z.enum(APPLICATION_ERROR_CODES);

export type ApplicationErrorCode = z.infer<typeof applicationErrorCodeSchema>;

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;

  constructor(code: ApplicationErrorCode, message: string) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
  }
}
