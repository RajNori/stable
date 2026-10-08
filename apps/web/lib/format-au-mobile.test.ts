import { describe, expect, it } from "vitest";

import { formatAustralianMobileInput } from "./format-au-mobile";

describe("formatAustralianMobileInput", () => {
  it("formats local and international digits consistently and clips excess digits", () => {
    expect(formatAustralianMobileInput("0412345678")).toBe("0412 345 678");
    expect(formatAustralianMobileInput("+61 (412) 345 678 99")).toBe(
      "0412 345 678",
    );
    expect(formatAustralianMobileInput("abc")).toBe("");
  });
});
