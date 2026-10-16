import { describe, expect, it } from "vitest";

import { gameDayNoticeFrom } from "./notices";

describe("gameDayNoticeFrom", () => {
  it("maps allowlisted keys to confirmation copy", () => {
    expect(gameDayNoticeFrom("duty-acknowledged")).toBe("Duty acknowledged.");
    expect(gameDayNoticeFrom(["duty-swap-accepted"])).toBe(
      "You have taken this duty.",
    );
  });

  it("ignores unknown, inherited and missing keys", () => {
    expect(gameDayNoticeFrom("<script>")).toBeUndefined();
    expect(gameDayNoticeFrom("toString")).toBeUndefined();
    expect(gameDayNoticeFrom(undefined)).toBeUndefined();
  });
});
