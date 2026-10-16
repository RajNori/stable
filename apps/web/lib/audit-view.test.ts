import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTIONS,
  actionsForFilters,
  melbourneDateStart,
  nextCalendarDate,
  parseAuditFilters,
} from "./audit-view";

describe("safe Club Admin audit view filters", () => {
  it("allows only the explicitly reviewed non-coaching operational actions", () => {
    const actions = actionsForFilters({
      category: null,
      action: null,
      from: null,
      to: null,
      page: 1,
    });

    expect(actions).toContain("season.created");
    expect(actions).toContain("invitation.revoked");
    expect(actions).toContain("fixture.imported");
    expect(actions).not.toContain("private_player_note.updated");
    expect(actions).not.toContain("game_player_stats.corrected");
    expect(actions).not.toContain("post_game_review.updated");
  });

  it("filters to a category and rejects actions outside that category", () => {
    const filters = parseAuditFilters({
      category: "access",
      action: "season.created",
    });

    expect(filters.category).toBe("access");
    expect(filters.action).toBeNull();
    expect(actionsForFilters(filters)).toEqual(AUDIT_ACTIONS.access);
  });

  it("ignores malformed date values and clamps pagination", () => {
    const filters = parseAuditFilters({
      category: "private-notes",
      action: "private_player_note.updated",
      from: "2026-02-30",
      to: "2026-01-01",
      page: "99999999999999999999",
    });

    expect(filters).toEqual({
      category: null,
      action: null,
      from: null,
      to: "2026-01-01",
      page: 1,
    });
  });

  it("uses Melbourne midnight across daylight and standard time", () => {
    expect(melbourneDateStart("2026-01-16")).toBe("2026-01-15T13:00:00.000Z");
    expect(melbourneDateStart("2026-07-16")).toBe("2026-07-15T14:00:00.000Z");
  });

  it("advances calendar dates without relying on a fixed UTC offset", () => {
    expect(nextCalendarDate("2026-10-03")).toBe("2026-10-04");
    expect(nextCalendarDate("2026-12-31")).toBe("2027-01-01");
    expect(nextCalendarDate("not-a-date")).toBeNull();
  });
});
