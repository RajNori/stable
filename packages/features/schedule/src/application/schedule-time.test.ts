import { describe, expect, it } from "vitest";

import { formatScheduleDateTime } from "./schedule-time.js";

describe("formatScheduleDateTime", () => {
  it("formats in the club timezone across the daylight-saving start", () => {
    expect(
      formatScheduleDateTime("2026-10-03T16:30:00.000Z", "Australia/Melbourne"),
    ).toBe("Sunday 4 October at 3:30 am");
  });

  it("formats in the club timezone across the daylight-saving end", () => {
    expect(
      formatScheduleDateTime("2026-04-04T16:30:00.000Z", "Australia/Melbourne"),
    ).toBe("Sunday 5 April at 2:30 am");
  });

  it("fails safely for invalid timestamps or timezones", () => {
    expect(
      formatScheduleDateTime("not-a-timestamp", "Australia/Melbourne"),
    ).toBe("Time unavailable");
    expect(
      formatScheduleDateTime("2026-10-03T16:30:00.000Z", "Not/AZone"),
    ).toBe("Time unavailable");
  });
});
