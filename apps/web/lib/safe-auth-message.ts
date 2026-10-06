import { ApplicationError, AUTH_ERROR_MESSAGES } from "@stable/contracts";

/** Application sentences only. Provider text never reaches the page. */
export function safeAuthMessage(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }

  return AUTH_ERROR_MESSAGES.INTERNAL;
}
