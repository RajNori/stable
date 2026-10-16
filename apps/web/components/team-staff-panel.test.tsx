import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TeamStaffPanel } from "./team-staff-panel";

afterEach(() => {
  cleanup();
});

const noop = () => undefined;

describe("team staff panel", () => {
  it("shows multiple roles for one adult and no contact search", () => {
    render(
      <TeamStaffPanel
        clubId="11111111-1111-4111-8111-111111111111"
        team={{
          id: "17171717-1717-4717-8717-171717171717",
          name: "U14 Boys",
        }}
        adults={[
          {
            userId: "19191919-1919-4919-8919-19191919191a",
            displayName: "Local Member",
          },
        ]}
        assignments={[
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            userId: "19191919-1919-4919-8919-19191919191a",
            role: "HEAD_COACH",
            active: true,
            label: "Local Member",
          },
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            userId: "19191919-1919-4919-8919-19191919191a",
            role: "TEAM_MANAGER",
            active: false,
            label: "Local Member",
          },
        ]}
        invitations={[
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            status: "pending",
            label: "Coach invitation",
            teamId: "17171717-1717-4717-8717-171717171717",
          },
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            status: "pending",
            label: "Other team invitation",
            teamId: "27272727-2727-4727-8727-272727272727",
          },
        ]}
        createInvitation={() => Promise.resolve({})}
        revokeInvitation={noop}
        assignRole={noop}
        revokeRole={noop}
        reactivateRole={noop}
      />,
    );

    expect(screen.getByRole("heading", { name: "U14 Boys" })).toBeTruthy();
    const assigned = screen.getByRole("list", { name: "Staff assignments" });
    expect(assigned.textContent).toContain("Head coach");
    expect(assigned.textContent).toContain("Team manager");
    expect(assigned.textContent).toContain("(revoked)");
    expect(screen.getByRole("button", { name: "Revoke" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeTruthy();
    expect(screen.getByText("Coach invitation pending")).toBeTruthy();
    expect(screen.queryByText("Other team invitation pending")).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(document.body.textContent).not.toContain("@");
  });

  it("fails closed when the team context is missing and shows the load error", () => {
    render(
      <TeamStaffPanel
        clubId="11111111-1111-4111-8111-111111111111"
        team={null}
        adults={[]}
        assignments={[]}
        assignRole={noop}
        revokeRole={noop}
        reactivateRole={noop}
        error="Team staff could not be loaded."
      />,
    );

    expect(screen.getByRole("heading", { name: "Team staff" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(
      "Team staff could not be loaded.",
    );
    expect(screen.queryByRole("button", { name: "Assign role" })).toBeNull();
    expect(
      screen.queryByRole("list", { name: "Staff assignments" }),
    ).toBeNull();
  });
});
