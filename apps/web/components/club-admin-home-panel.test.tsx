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
          invitations: { pendingCount: 0, expiringWithinSevenDaysCount: 0 },
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

  it("reports when no checked setup or invitation issues remain", () => {
    render(
      <ClubAdminHomePanel
        themeKey="mustangs"
        summary={{
          activeTeamCount: 1,
          activeSeasonCount: 1,
          teamsNeedingLeadership: [],
          invitations: { pendingCount: 0, expiringWithinSevenDaysCount: 0 },
        }}
      />,
    );

    expect(
      screen.getByText(
        "No outstanding setup, leadership, or invitation issues found.",
      ),
    ).toBeTruthy();
  });

  it("directs the Club Admin to create an active season", () => {
    render(
      <ClubAdminHomePanel
        themeKey="mustangs"
        summary={{
          activeTeamCount: 2,
          activeSeasonCount: 0,
          teamsNeedingLeadership: [],
          invitations: { pendingCount: 0, expiringWithinSevenDaysCount: 0 },
        }}
      />,
    );

    expect(screen.getByText(/No active season/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Set up an active season" })
        .getAttribute("href"),
    ).toBe("/club-structure");
  });

  it("surfaces pending and expiring invitation counts without contact details", () => {
    const { container } = render(
      <ClubAdminHomePanel
        themeKey="mustangs"
        summary={{
          activeTeamCount: 1,
          activeSeasonCount: 1,
          teamsNeedingLeadership: [],
          invitations: { pendingCount: 3, expiringWithinSevenDaysCount: 1 },
        }}
      />,
    );

    expect(
      screen.getByText(/3 pending staff or guardian invitations/),
    ).toBeTruthy();
    expect(screen.getByText(/1 expire within seven days/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Review invitations" })
        .getAttribute("href"),
    ).toBe("/players");
    expect(container.textContent).not.toContain("@example");
  });

  it("reports invitation counts as unavailable instead of implying none are pending", () => {
    render(
      <ClubAdminHomePanel
        themeKey="mustangs"
        summary={{
          activeTeamCount: 1,
          activeSeasonCount: 1,
          teamsNeedingLeadership: [],
          invitations: null,
        }}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Invitation status could not be loaded",
    );
    expect(screen.queryByText(/No outstanding setup/)).toBeNull();
  });
});
