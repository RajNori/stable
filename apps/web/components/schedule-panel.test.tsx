import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SchedulePanel } from "./schedule-panel";
import type { ScheduleEntry } from "@stable/schedule";

const entry = (eventType: ScheduleEntry["eventType"]): ScheduleEntry => ({
  eventId:
    eventType === "GAME"
      ? "55555555-5555-4555-8555-555555555555"
      : "66666666-6666-4666-8666-666666666666",
  clubId: "11111111-1111-4111-8111-111111111111",
  teamId: "33333333-3333-4333-8333-333333333333",
  eventType,
  startsAt:
    eventType === "GAME"
      ? "2026-10-10T07:30:00.000Z"
      : "2026-10-12T07:00:00.000Z",
  endsAt: null,
  courtLabel: null,
  eventStatus: "SCHEDULED",
  opponentName: eventType === "GAME" ? "Visitors" : null,
  roundLabel: eventType === "GAME" ? "Round 1" : null,
});

afterEach(() => {
  cleanup();
});

describe("schedule panel", () => {
  it("shows games and training on one agenda", () => {
    render(
      <SchedulePanel
        teamName="U14 Boys"
        entries={[entry("GAME"), entry("TRAINING")]}
      />,
    );

    const agenda = screen.getByRole("list", { name: "Agenda" });
    expect(agenda.textContent).toContain("Round 1: Visitors");
    expect(agenda.textContent).toContain("Training at");
  });

  it("shows an empty range", () => {
    render(<SchedulePanel teamName="U14 Boys" entries={[]} />);
    expect(screen.getByText("No events in this range.")).toBeTruthy();
  });

  it("uses safe labels for games with missing provider labels and shows load errors", () => {
    render(
      <SchedulePanel
        teamName="U14 Boys"
        error="Schedule could not be refreshed."
        entries={[
          {
            ...entry("GAME"),
            opponentName: null,
            roundLabel: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "Schedule could not be refreshed.",
    );
    expect(screen.getByRole("list", { name: "Agenda" }).textContent).toContain(
      "Game: Opponent at",
    );
  });
});
