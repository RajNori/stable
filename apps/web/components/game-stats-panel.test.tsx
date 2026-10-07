import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameCoachingStats } from "@stable/game-day";

import { GameStatsPanel } from "./game-stats-panel";

const fixture: GameCoachingStats = {
  eventId: "55555555-5555-4555-8555-555555555555",
  clubId: "11111111-1111-4111-8111-111111111111",
  teamId: "33333333-3333-4333-8333-333333333333",
  source: "MANUAL",
  teamScore: 62,
  opponentScore: 59,
  resultStatus: "FINAL",
  scheduledMinutes: 40,
  players: [
    {
      playerId: "66666666-6666-4666-8666-666666666666",
      displayName: "Alex Example",
      activeRegistration: true,
      stat: null,
    },
    {
      playerId: "77777777-7777-4777-8777-777777777777",
      displayName: "Casey Historical",
      activeRegistration: false,
      stat: {
        points: 10,
        rebounds: 3,
        assists: 1,
        steals: 0,
        fouls: 1,
        approximateMinutes: 30,
      },
    },
  ],
};
const corrections = [
  {
    eventId: fixture.eventId,
    playerId: "66666666-6666-4666-8666-666666666666",
    actorId: "88888888-8888-4888-8888-888888888888",
    occurredAt: "2026-10-07T10:00:00.000Z",
    before: {
      points: 1,
      rebounds: 0,
      assists: 0,
      steals: 0,
      fouls: 0,
      approximateMinutes: 1,
    },
    after: {
      points: 2,
      rebounds: 0,
      assists: 0,
      steals: 0,
      fouls: 0,
      approximateMinutes: 1,
    },
  },
];

afterEach(cleanup);

describe("game stats panel", () => {
  it("allows coaches to save manual scores and registered-player stats", () => {
    render(
      <GameStatsPanel
        stats={fixture}
        corrections={corrections}
        teamId={fixture.teamId}
        canWrite
        scoreAction={vi.fn()}
        playerStatAction={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Save final score" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Save stats" })).toHaveLength(
      2,
    );
    expect(
      screen
        .getByRole("spinbutton", {
          name: "Approximate minutes for Alex Example",
        })
        .getAttribute("max"),
    ).toBe("40");
    expect(
      screen.getByText("Restricted staff correction history"),
    ).toBeTruthy();
    expect(
      screen.getByText(/Player 66666666-6666-4666-8666-666666666666/),
    ).toBeTruthy();
    expect(screen.queryByText("Alex Example", { selector: "p" })).toBeNull();
  });

  it("shows imported results read-only and offers no score form", () => {
    render(
      <GameStatsPanel
        stats={{ ...fixture, source: "IMPORT" }}
        corrections={[]}
        teamId={fixture.teamId}
        canWrite
        scoreAction={vi.fn()}
        playerStatAction={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Imported official result (read only)"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Save final score" }),
    ).toBeNull();
  });

  it("permits correction for a transferred historical line", () => {
    render(
      <GameStatsPanel
        stats={fixture}
        corrections={[]}
        teamId={fixture.teamId}
        canWrite
        scoreAction={vi.fn()}
        playerStatAction={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "Save stats" });
    expect(buttons).toHaveLength(2);
    expect(screen.getByText("(historical game record)")).toBeTruthy();
  });

  it("does not show any write buttons without write access", () => {
    render(
      <GameStatsPanel
        stats={fixture}
        corrections={[]}
        teamId={fixture.teamId}
        canWrite={false}
        scoreAction={vi.fn()}
        playerStatAction={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Save final score" }),
    ).toBeNull();
    expect(
      screen.queryAllByRole("button", { name: "Save stats" }),
    ).toHaveLength(0);
  });
});
