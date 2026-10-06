import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InvitationPanel } from "./invitation-panel";

afterEach(() => {
  cleanup();
});

describe("invitation panel", () => {
  it("shows status and does not offer a people search", () => {
    render(
      <InvitationPanel
        invitations={[
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "pending",
            label: "person@example.com",
            playerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        ]}
        hidden={{
          clubId: "11111111-1111-4111-8111-111111111111",
          playerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          returnTo: "/players",
        }}
        includeRole={false}
        createInvitation={() => Promise.resolve({})}
        revokeInvitation={() => undefined}
      />,
    );

    expect(screen.getByText(/pending/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create invitation" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Revoke invitation" }),
    ).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
