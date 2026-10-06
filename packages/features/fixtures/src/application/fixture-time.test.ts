import { describe, expect, it } from "vitest";

import {
  localDateTimeToUtcIso,
  utcIsoToLocalDateTime,
} from "./fixture-time.js";

describe("fixture local time", () => {
  it("converts Melbourne wall time across daylight saving", () => {
    expect(
      localDateTimeToUtcIso("2026-10-10T18:30", "Australia/Melbourne"),
    ).toBe("2026-10-10T07:30:00.000Z");
    expect(
      localDateTimeToUtcIso("2026-07-10T18:30", "Australia/Melbourne"),
    ).toBe("2026-07-10T08:30:00.000Z");
  });

  it("round-trips an instant and rejects an unknown zone", () => {
    expect(
      utcIsoToLocalDateTime("2026-10-10T07:30:00.000Z", "Australia/Melbourne"),
    ).toBe("2026-10-10T18:30");
    expect(
      utcIsoToLocalDateTime("2026-07-10T08:30:00.000Z", "Australia/Melbourne"),
    ).toBe("2026-07-10T18:30");
    expect(() => localDateTimeToUtcIso("18:30", "Australia/Melbourne")).toThrow(
      "Fixture details failed validation.",
    );
    expect(() =>
      localDateTimeToUtcIso("2026-13-10T18:30", "Australia/Melbourne"),
    ).toThrow("Fixture details failed validation.");
    expect(() =>
      localDateTimeToUtcIso("2026-02-31T18:30", "Australia/Melbourne"),
    ).toThrow("Fixture details failed validation.");
    expect(() =>
      utcIsoToLocalDateTime("not-a-time", "Australia/Melbourne"),
    ).toThrow("Fixture details failed validation.");
    expect(() =>
      localDateTimeToUtcIso("2026-10-10T18:30", "Not/AZone"),
    ).toThrow("Fixture details failed validation.");
  });
});
