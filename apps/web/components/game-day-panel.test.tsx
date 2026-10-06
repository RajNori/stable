import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GameDayProjection } from "@stable/game-day";

import { GameDayPanel } from "./game-day-panel";

const projection: GameDayProjection = {
  eventId: "55555555-5555-4555-8555-555555555555",
  clubId: "11111111-1111-4111-8111-111111111111",
  teamId: "33333333-3333-4333-8333-333333333333",
  opponentName: "Visitors",
  roundLabel: "Round 1",
  officialStartAt: "2026-10-10T07:30:00.000Z",
  arrivalAt: null,
  venueText: "Home",
  courtLabel: "Court 1",
  uniformNote: "White",
  coachFocus: "Press",
  ownRsvp: "UNANSWERED",
  ownDutyLabel: null,
  ownDutyStatus: null,
  attendingCount: null,
  unavailableCount: null,
  unsureCount: null,
  unansweredCount: null,
};

afterEach(() => {
  cleanup();
});

describe("game day panel", () => {
  it("shows the guardian projection without staff counts", () => {
    render(<GameDayPanel projection={projection} />);
    expect(screen.getByText("Round 1: Visitors")).toBeTruthy();
    expect(screen.getByText("RSVP UNANSWERED")).toBeTruthy();
    expect(screen.queryByText(/Attending/)).toBeNull();
  });

  it("shows staff counts when the projection includes them", () => {
    render(
      <GameDayPanel
        projection={{
          ...projection,
          attendingCount: 3,
          unavailableCount: 1,
          unsureCount: 0,
          unansweredCount: 4,
        }}
      />,
    );
    expect(screen.getByText(/Attending 3/)).toBeTruthy();
  });
});
