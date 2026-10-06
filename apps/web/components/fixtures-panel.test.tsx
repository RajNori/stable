import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FixturesPanel } from "./fixtures-panel";
import type { FixtureSummary } from "./fixtures-panel";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";

const fixture: FixtureSummary = {
  eventId: "55555555-5555-4555-8555-555555555555",
  opponentName: "Visitors",
  roundLabel: "Round 1",
  officialStartLocal: "2026-10-10T18:30",
  arrivalLocal: "",
  uniformNote: null,
  coachFocus: null,
  teamNote: null,
  fixtureStatus: "SCHEDULED",
};

afterEach(() => {
  cleanup();
});

describe("fixtures panel", () => {
  it("keeps the overlay form off the official opponent field", () => {
    render(
      <FixturesPanel
        clubId={clubId}
        teamId={teamId}
        teamName="U14 Boys"
        fixtures={[fixture]}
        canManageOfficial
        canManageOverlay
        createAction={vi.fn()}
        officialAction={vi.fn()}
        overlayAction={vi.fn()}
      />,
    );

    expect(screen.getByText(/Visitors/)).toBeTruthy();
    const overlay = screen
      .getByRole("button", { name: "Save team overlay" })
      .closest("form");
    expect(overlay?.querySelector("[name='opponentName']")).toBeNull();
    expect(overlay?.querySelector("[name='teamScore']")).toBeNull();
    const official = screen
      .getByRole("button", { name: "Save official fixture" })
      .closest("form");
    expect(official?.querySelector("[name='arrivalAt']")).toBeNull();
    expect(official?.querySelector("[name='uniformNote']")).toBeNull();
  });

  it("hides official and overlay writes when the caller cannot manage them", () => {
    render(
      <FixturesPanel
        clubId={clubId}
        teamId={teamId}
        teamName="U14 Boys"
        fixtures={[]}
        canManageOfficial={false}
        canManageOverlay={false}
        createAction={vi.fn()}
        officialAction={vi.fn()}
        overlayAction={vi.fn()}
        error="This fixture action is not allowed."
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "This fixture action is not allowed.",
    );
    expect(screen.queryByRole("button", { name: "Add fixture" })).toBeNull();
    expect(screen.getByText("No fixtures yet.")).toBeTruthy();
  });
});
