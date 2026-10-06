import type { TeamRoster } from "@stable/roster";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RosterPanel } from "./roster-panel";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";
const playerId = "18181818-1818-4818-8818-181818181818";

afterEach(() => {
  cleanup();
});

function roster(
  visibility: TeamRoster["visibility"],
  name: string,
): TeamRoster {
  return {
    teamId,
    visibility,
    canManage: visibility === "full",
    entries: [{ playerId, teamId, name }],
  };
}

describe("roster panel", () => {
  it("shows a masked name without manage controls", () => {
    render(
      <RosterPanel
        clubId={clubId}
        teamName="U14 Boys"
        roster={{ ...roster("masked", "Alexander R."), canManage: false }}
        registerPlayer={vi.fn()}
        unregisterPlayer={vi.fn()}
      />,
    );

    expect(screen.getByRole("list", { name: "Roster" }).textContent).toContain(
      "Alexander R.",
    );
    expect(
      screen.getByRole("list", { name: "Roster" }).textContent,
    ).not.toContain("Robertson");
    expect(
      screen.queryByRole("button", { name: "Register player" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Unregister player" }),
    ).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("shows a registered name and manage controls for a manager", () => {
    render(
      <RosterPanel
        clubId={clubId}
        teamName="U14 Boys"
        roster={roster("full", "Alexander Robertson")}
        registerPlayer={vi.fn()}
        unregisterPlayer={vi.fn()}
      />,
    );

    expect(screen.getByText("Alexander Robertson")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Register player" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Unregister player" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Phone")).toBeNull();
  });

  it("shows a registered name without manage controls for a coach", () => {
    render(
      <RosterPanel
        clubId={clubId}
        teamName="U14 Boys"
        roster={{ ...roster("full", "Alexander Robertson"), canManage: false }}
      />,
    );

    expect(screen.getByText("Alexander Robertson")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Register player" }),
    ).toBeNull();
  });
});
