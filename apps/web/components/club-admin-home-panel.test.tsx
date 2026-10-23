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
          playersMissingGuardianCount: 0,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Overview" })).toBeTruthy();
    expect(screen.getByText("Active teams")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(
      screen.getByText(/needs a Head Coach and Team Manager/),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Review staff" }).getAttribute("href"),
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
          playersMissingGuardianCount: 0,
        }}
      />,
    );

    expect(screen.getByText(/You’re in good shape/)).toBeTruthy();
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
          playersMissingGuardianCount: 0,
        }}
      />,
    );

    expect(screen.getByText(/There isn’t an active season/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Set up a season" })
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
          playersMissingGuardianCount: 0,
        }}
      />,
    );

    expect(screen.getByText(/3 invitations are waiting/)).toBeTruthy();
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
          playersMissingGuardianCount: null,
        }}
      />,
    );

    expect(
      screen.getByText("Invitation status could not be loaded."),
    ).toBeTruthy();
    expect(screen.queryByText(/No outstanding setup/)).toBeNull();
  });

  it("surfaces a count of active players without guardian links, without child details", () => {
    const { container } = render(
      <ClubAdminHomePanel
        themeKey="mustangs"
        summary={{
          activeTeamCount: 1,
          activeSeasonCount: 1,
          teamsNeedingLeadership: [],
          invitations: { pendingCount: 0, expiringWithinSevenDaysCount: 0 },
          playersMissingGuardianCount: 2,
        }}
      />,
    );

    expect(
      screen.getByText("2 active players need an active guardian link."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Review player links" })
        .getAttribute("href"),
    ).toBe("/players");
    expect(container.textContent).not.toContain("Player One");
  });
});
