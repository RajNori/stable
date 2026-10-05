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

    fireEvent.change(screen.getByLabelText("Season name"), {
      target: { value: "Autumn" },
    });
    fireEvent.change(screen.getByLabelText("Team name"), {
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
