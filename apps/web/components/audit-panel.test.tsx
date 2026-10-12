import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuditPanel } from "./audit-panel";

afterEach(() => cleanup());

describe("Club Admin audit panel", () => {
  it("shows only safe operational labels and opaque references", () => {
    render(
      <AuditPanel
        events={[
          {
            id: "event-opaque",
            action: "team_staff.revoked",
            actorUserId: "actor-opaque",
            targetId: "target-opaque",
            createdAt: "2026-10-12T23:00:00.000Z",
          },
        ]}
        category="access"
        action="team_staff.revoked"
        from="2026-10-13"
        to="2026-10-13"
        page={1}
        hasNext={false}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Operational audit" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Staff access revoked")).toHaveLength(2);
    expect(screen.getByText("actor-opaque")).toBeTruthy();
    expect(screen.getByText("target-opaque")).toBeTruthy();
    expect(screen.getByText("13 Oct 2026, 10:00 am")).toBeTruthy();
    expect(screen.queryByText(/private note/i)).toBeNull();
    expect(screen.queryByRole("link", { name: "Next page" })).toBeNull();
  });

  it("keeps filters on pagination and offers a safe empty state", () => {
    render(
      <AuditPanel
        events={[]}
        category="structure"
        action={null}
        from="2026-10-01"
        to="2026-10-02"
        page={2}
        hasNext
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "No operational audit events",
    );
    expect(
      screen.getByRole("link", { name: "Previous page" }).getAttribute("href"),
    ).toBe("/audit?page=1&category=structure&from=2026-10-01&to=2026-10-02");
  });
});
