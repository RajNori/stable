import type { ClubStructureSnapshot } from "@stable/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClubStructurePanel } from "./club-structure-panel";

const clubId = "11111111-1111-4111-8111-111111111111";

const snapshot: ClubStructureSnapshot = {
  seasons: [
    {
      id: "88888888-8888-4888-8888-888888888888",
      clubId,
      name: "2026 Winter",
      active: true,
    },
  ],
  competitions: [],
  teams: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      clubId,
      seasonId: "88888888-8888-4888-8888-888888888888",
      competitionId: null,
      venueId: null,
      name: "U14 Boys",
      active: true,
    },
  ],
  venues: [],
};

afterEach(() => {
  cleanup();
});

describe("club structure panel", () => {
  it("shows the current seasons and teams and submits a new pair", () => {
    const action = vi.fn();
    render(
      <ClubStructurePanel
        clubId={clubId}
        snapshot={snapshot}
        action={action}
      />,
    );

    expect(screen.getByRole("list", { name: "Seasons" }).textContent).toContain(
      "2026 Winter",
    );
    expect(screen.getByRole("list", { name: "Teams" }).textContent).toContain(
      "U14 Boys",
    );
    expect(
      screen.getByRole("link", { name: "Roster" }).getAttribute("href"),
    ).toBe("/teams/99999999-9999-4999-8999-999999999999/roster");
    expect(
      screen.getByRole("link", { name: "Fixtures" }).getAttribute("href"),
    ).toBe("/teams/99999999-9999-4999-8999-999999999999/fixtures");
    expect(
      screen.getByRole("link", { name: "Schedule" }).getAttribute("href"),
    ).toBe("/teams/99999999-9999-4999-8999-999999999999/schedule");

    fireEvent.change(screen.getByLabelText("Season name"), {
      target: { value: "Autumn" },
    });
    fireEvent.change(screen.getByLabelText("First team name"), {
      target: { value: "U12 Girls" },
    });
    const form = screen
      .getByRole("button", { name: "Create season and team" })
      .closest("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Expected the create control to sit in a form.");
    }
    fireEvent.submit(form);

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]?.[0];
    expect(formData).toBeInstanceOf(FormData);
    if (!(formData instanceof FormData)) {
      throw new Error("Expected the form action to receive FormData.");
    }
    expect(formData.get("seasonName")).toBe("Autumn");
    expect(formData.get("teamName")).toBe("U12 Girls");
    expect(formData.get("clubId")).toBe(clubId);
  });

  it("creates competitions, venues, and teams with active structure links", () => {
    const createCompetitionAction = vi.fn();
    const createVenueAction = vi.fn();
    const createTeamAction = vi.fn();
    const inactiveSeason = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      clubId,
      name: "2025 Winter",
      active: false,
    };
    const competition = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      clubId,
      seasonId: "88888888-8888-4888-8888-888888888888",
      name: "Metro League",
      active: true,
    };
    const venue = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      clubId,
      name: "North Court",
      active: true,
    };
    render(
      <ClubStructurePanel
        clubId={clubId}
        snapshot={{
          ...snapshot,
          seasons: [...snapshot.seasons, inactiveSeason],
          competitions: [competition],
          venues: [venue],
        }}
        action={vi.fn()}
        createCompetitionAction={createCompetitionAction}
        createVenueAction={createVenueAction}
        createTeamAction={createTeamAction}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Competitions" }).textContent,
    ).toContain("Metro League");
    expect(screen.getByRole("list", { name: "Venues" }).textContent).toContain(
      "North Court",
    );
    expect(screen.getAllByRole("option", { name: "2026 Winter" })).toHaveLength(
      2,
    );
    expect(screen.queryByRole("option", { name: "2025 Winter" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Competition name"), {
      target: { value: "District League" },
    });
    submit(screen.getByRole("button", { name: "Create competition" }));
    const competitionData = createCompetitionAction.mock
      .calls[0]?.[0] as FormData;
    expect(competitionData.get("clubId")).toBe(clubId);
    expect(competitionData.get("seasonId")).toBe(snapshot.seasons[0]?.id);
    expect(competitionData.get("name")).toBe("District League");

    fireEvent.change(screen.getByLabelText("Venue name"), {
      target: { value: "East Court" },
    });
    submit(screen.getByRole("button", { name: "Create venue" }));
    const venueData = createVenueAction.mock.calls[0]?.[0] as FormData;
    expect(venueData.get("clubId")).toBe(clubId);
    expect(venueData.get("name")).toBe("East Court");

    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "U16 Girls" },
    });
    submit(screen.getByRole("button", { name: "Create team" }));
    const teamData = createTeamAction.mock.calls[0]?.[0] as FormData;
    expect(teamData.get("clubId")).toBe(clubId);
    expect(teamData.get("seasonId")).toBe(snapshot.seasons[0]?.id);
    expect(teamData.get("competitionId")).toBe("");
    expect(teamData.get("venueId")).toBe("");
    expect(teamData.get("name")).toBe("U16 Girls");
  });

  it("updates names and lifecycle state without exposing deletion controls", () => {
    const updateSeasonAction = vi.fn();
    const updateCompetitionAction = vi.fn();
    const updateTeamAction = vi.fn();
    const updateVenueAction = vi.fn();
    render(
      <ClubStructurePanel
        clubId={clubId}
        snapshot={{
          ...snapshot,
          competitions: [
            {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              clubId,
              seasonId: snapshot.seasons[0]?.id ?? "",
              name: "Metro League",
              active: true,
            },
          ],
          venues: [
            {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              clubId,
              name: "North Court",
              active: true,
            },
          ],
        }}
        action={vi.fn()}
        updateSeasonAction={updateSeasonAction}
        updateCompetitionAction={updateCompetitionAction}
        updateTeamAction={updateTeamAction}
        updateVenueAction={updateVenueAction}
      />,
    );

    const updates = [
      {
        label: "season name",
        button: "Save season",
        action: updateSeasonAction,
      },
      {
        label: "competition name",
        button: "Save competition",
        action: updateCompetitionAction,
      },
      { label: "team name", button: "Save team", action: updateTeamAction },
      { label: "venue name", button: "Save venue", action: updateVenueAction },
    ];
    for (const update of updates) {
      fireEvent.change(screen.getByLabelText(update.label), {
        target: { value: `Updated ${update.label}` },
      });
      const button = screen.getByRole("button", { name: update.button });
      if (update.label === "season name") {
        const form = button.closest("form");
        const status = form?.querySelector('select[name="active"]');
        if (!(status instanceof HTMLSelectElement)) {
          throw new Error("Expected an active status control for the season.");
        }
        fireEvent.change(status, { target: { value: "false" } });
      }
      submit(button);
      const data = update.action.mock.calls[0]?.[0] as FormData;
      expect(data.get("recordId")).toBeTruthy();
      expect(data.get("name")).toBe(`Updated ${update.label}`);
      expect(data.get("active")).toBe(
        update.label === "season name" ? "false" : "true",
      );
    }
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("shows a safe error and hides the form when the club is unavailable", () => {
    render(
      <ClubStructurePanel
        clubId={null}
        snapshot={{ seasons: [], competitions: [], teams: [], venues: [] }}
        action={vi.fn()}
        error="Club structure could not be read."
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "Club structure could not be read.",
    );
    expect(
      screen.queryByRole("button", { name: "Create season and team" }),
    ).toBeNull();
  });
});

function submit(button: HTMLElement): void {
  const form = button.closest("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Expected the create control to sit in a form.");
  }
  fireEvent.submit(form);
}
