import { ApplicationError, AUTH_ERROR_MESSAGES } from "@stable/contracts";

/**
 * Shows an application error sentence. Provider text, addresses, and codes
 * never pass through.
 */
export function safeAuthMessage(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }

  return AUTH_ERROR_MESSAGES.INTERNAL;
}
