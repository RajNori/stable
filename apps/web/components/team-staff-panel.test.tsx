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
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(document.body.textContent).not.toContain("@");
  });
});
