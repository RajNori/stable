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
  fillInLabel: null,
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
    expect(screen.queryByRole("button", { name: "Save RSVP" })).toBeNull();
  });

  it("offers a masked RSVP form for a managed player", () => {
    render(
      <GameDayPanel
        projection={projection}
        players={[{ playerId: projection.eventId, label: "Alex R." }]}
        recordAction={() => Promise.resolve()}
      />,
    );
    expect(screen.getByText("Alex R.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save RSVP" })).toBeTruthy();
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

  it("shows the error state without exposing a missing game projection", () => {
    render(<GameDayPanel projection={null} error="The game is unavailable." />);

    expect(screen.getByRole("alert").textContent).toBe(
      "The game is unavailable.",
    );
    expect(screen.queryByText("Round 1: Visitors")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows optional team duties, swaps, fill-in, and RSVP actions", () => {
    render(
      <GameDayPanel
        projection={{
          ...projection,
          ownDutyLabel: "Scorer",
          ownDutyStatus: "ASSIGNED",
          fillInLabel: "Requested",
          attendingCount: 2,
          unavailableCount: 1,
          unsureCount: 1,
          unansweredCount: 3,
        }}
        players={[{ playerId: "player-1", label: "Alex R." }]}
        recordAction={() => Promise.resolve()}
        dutyProposal={{
          fingerprint: "opaque-proposal",
          lines: ["Scorer: Alex"],
        }}
        createDuty={() => Promise.resolve()}
        commitDuty={() => Promise.resolve()}
        acknowledgeDuty={() => Promise.resolve()}
        swaps={[{ id: "swap-1", label: "Scorer" }]}
        requestSwap={() => Promise.resolve()}
        acceptSwap={() => Promise.resolve()}
        fillRequestId={null}
        fillCandidates={[{ playerId: "candidate-1", displayName: "Morgan R." }]}
        requestFillIn={() => Promise.resolve()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save RSVP" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Request fill-in" }),
    ).toBeTruthy();
    expect(screen.getByText("Candidate Morgan R.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Acknowledge duty" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Request duty swap" }),
    ).toBeTruthy();
    expect(screen.getByText("Open swap Scorer")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Commit allocation" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add open duty" })).toBeTruthy();
  });

  it("shows only open fill-in responses for a pending request", () => {
    render(
      <GameDayPanel
        projection={projection}
        fillRequestId="request-1"
        fillResponses={[{ playerId: "player-2", displayName: "Sam R." }]}
        ownFillPlayers={[{ playerId: "player-1", displayName: "Alex R." }]}
        confirmFillIn={() => Promise.resolve()}
        respondFillIn={() => Promise.resolve()}
      />,
    );

    expect(screen.getByText("Response Sam R.")).toBeTruthy();
    expect(screen.getByText("Your player Alex R.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Confirm fill-in" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Respond to fill-in" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Request fill-in" }),
    ).toBeNull();
  });

  it("does not offer submit actions without their matching capability data", () => {
    render(
      <GameDayPanel
        projection={{ ...projection, ownDutyLabel: null }}
        dutyProposal={{ fingerprint: "", lines: [] }}
        commitDuty={() => Promise.resolve()}
        acknowledgeDuty={() => Promise.resolve()}
        requestSwap={() => Promise.resolve()}
        acceptSwap={() => Promise.resolve()}
        swaps={[]}
        fillRequestId="request-2"
        confirmFillIn={() => Promise.resolve()}
        fillResponses={[]}
        respondFillIn={() => Promise.resolve()}
        ownFillPlayers={[]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Commit allocation" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Acknowledge duty" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Request duty swap" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept swap" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Confirm fill-in" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Respond to fill-in" }),
    ).toBeNull();
  });
});
