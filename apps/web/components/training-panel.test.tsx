import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrainingPanel } from "./training-panel";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  cleanup();
});

describe("training panel", () => {
  it("shows a practice, a weekly series, and check-in", () => {
    render(
      <TrainingPanel
        clubId={clubId}
        teamId={teamId}
        timezone="Australia/Melbourne"
        sessions={[
          {
            eventId: "55555555-5555-4555-8555-555555555555",
            startsAt: "2026-10-14T07:30:00.000Z",
          },
        ]}
        canManage
        canCheckIn
        createSession={() => Promise.resolve()}
        createSeries={() => Promise.resolve()}
        checkIn={() => Promise.resolve()}
      />,
    );
    expect(
      screen.getByText("Training at 2026-10-14T07:30:00.000Z"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add practice" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add weekly series" }),
    ).toBeTruthy();
  });

  it("hides writes from a caller who cannot manage training", () => {
    render(
      <TrainingPanel
        clubId={clubId}
        teamId={teamId}
        timezone="Australia/Melbourne"
        sessions={[]}
        canManage={false}
        canCheckIn={false}
        error="This training action is not allowed."
        createSession={() => Promise.resolve()}
        createSeries={() => Promise.resolve()}
        checkIn={() => Promise.resolve()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "This training action is not allowed.",
    );
    expect(screen.queryByRole("button", { name: "Add practice" })).toBeNull();
    expect(screen.getByText("No training in this range.")).toBeTruthy();
  });

  it("does not expose check-in when the caller only has schedule visibility", () => {
    render(
      <TrainingPanel
        clubId={clubId}
        teamId={teamId}
        timezone="Australia/Melbourne"
        sessions={[{ eventId: "event-1", startsAt: "2026-10-14T07:30:00Z" }]}
        canManage={false}
        canCheckIn={false}
        createSession={() => Promise.resolve()}
        createSeries={() => Promise.resolve()}
        checkIn={() => Promise.resolve()}
      />,
    );

    expect(screen.getByText("Training at 2026-10-14T07:30:00Z")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add practice" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add weekly series" }),
    ).toBeNull();
  });
});
