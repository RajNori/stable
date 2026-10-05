import { ApplicationError } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { normalizeAustralianMobile } from "./index.js";

describe("normalizeAustralianMobile", () => {
  it.each([
    ["0412345678", "+61412345678"],
    ["0412 345 678", "+61412345678"],
    ["04 1234 5678", "+61412345678"],
    ["0412  345  678", "+61412345678"],
    ["(04) 1234-5678", "+61412345678"],
    ["+61412345678", "+61412345678"],
    ["+61 412 345 678", "+61412345678"],
    ["+61 4 1234 5678", "+61412345678"],
    ["61412345678", "+61412345678"],
  ])("normalizes %j to %s", (input, expected) => {
    expect(normalizeAustralianMobile(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "041234567",
    "04123456789",
    "0212345678",
    "0312345678",
    "0712345678",
    "0812345678",
    "0512345678",
    "1300123456",
    "1800123456",
    "+6141234567",
    "+614123456789",
    "+610412345678",
    "+14155552671",
    "+447911123456",
    "0412abc678",
    "not-a-number",
  ])("rejects %j before any network call", (input) => {
    expect(() => normalizeAustralianMobile(input)).toThrow(ApplicationError);
    try {
      normalizeAustralianMobile(input);
    } catch (error) {
      expect(error).toBeInstanceOf(ApplicationError);
      if (!(error instanceof ApplicationError)) {
        return;
      }
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(error.message).toBe("Enter an Australian mobile number.");
      const submitted = input.trim();
      if (submitted.length > 0) {
        expect(error.message).not.toContain(submitted);
      }
    }
  });
});
