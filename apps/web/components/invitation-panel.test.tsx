import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("shows a one-time link with the token in the fragment", async () => {
    const token = "ef".repeat(32);
    const createInvitation = vi.fn(() => Promise.resolve({ token }));
    render(
      <InvitationPanel
        invitations={[]}
        hidden={{
          clubId: "11111111-1111-4111-8111-111111111111",
          playerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          returnTo: "/players",
        }}
        includeRole={false}
        createInvitation={createInvitation}
        revokeInvitation={() => undefined}
      />,
    );

    const form = screen
      .getByRole("button", { name: "Create invitation" })
      .closest("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Expected the invitation form.");
    }
    fireEvent.submit(form);

    const link = await screen.findByLabelText("Invitation link");
    if (!(link instanceof HTMLInputElement)) {
      throw new Error("Expected the invitation link field.");
    }
    expect(link.value).toBe(
      `${window.location.origin}/invitations/accept#${token}`,
    );
    expect(link.value.includes("?token=")).toBe(false);
  });
});
