import { ApplicationError } from "@stable/contracts";

const AUSTRALIAN_MOBILE_E164 = /^\+614\d{8}$/;
const INVALID_MOBILE_MESSAGE = "Enter an Australian mobile number.";

/**
 * Normalizes an Australian mobile to E.164 before any provider call.
 * Accepts `04` plus eight digits, `614` plus eight digits, or `+614` plus eight digits.
 * Spaces, hyphens, and parentheses are ignored. Every other number is rejected.
 */
export function normalizeAustralianMobile(input: string): string {
  const compact = input.replace(/[\s()-]/g, "");
  const candidate = toAustralianMobileE164(compact);
  if (candidate === null || !AUSTRALIAN_MOBILE_E164.test(candidate)) {
    throw new ApplicationError("VALIDATION_FAILED", INVALID_MOBILE_MESSAGE);
  }

  return candidate;
}

function toAustralianMobileE164(compact: string): string | null {
  if (/^04\d{8}$/.test(compact)) {
    return `+61${compact.slice(1)}`;
  }

  if (/^614\d{8}$/.test(compact)) {
    return `+${compact}`;
  }

  if (compact.startsWith("+")) {
    return compact;
  }

  return null;
}
