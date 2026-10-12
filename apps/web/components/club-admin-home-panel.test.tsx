import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ClubAdminHomePanel } from "./club-admin-home-panel";

afterEach(cleanup);

describe("club admin home panel", () => {
  it("surfaces teams missing leadership with scoped staff links", () => {
    render(
      <ClubAdminHomePanel
        themeKey="mustangs"
        summary={{
          activeTeamCount: 2,
          activeSeasonCount: 1,
          teamsNeedingLeadership: [
            {
              id: "team-one",
              name: "U14 Boys",
              missingRoles: ["Head Coach", "Team Manager"],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Club overview" })).toBeTruthy();
    expect(screen.getByText("Active teams")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(/needs Head Coach and Team Manager/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Review team staff" })
        .getAttribute("href"),
    ).toBe("/teams/team-one/staff");
  });

  it("reports only the leadership checks that were actually completed", () => {
    render(
      <ClubAdminHomePanel
        themeKey="mustangs"
        summary={{
          activeTeamCount: 1,
          activeSeasonCount: 1,
          teamsNeedingLeadership: [],
        }}
      />,
    );

    expect(
      screen.getByText("Every active team has a Head Coach and Team Manager."),
    ).toBeTruthy();
  });
});
