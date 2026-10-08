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

  it("offers revoke only for pending invitations and includes coach roles", () => {
    render(
      <InvitationPanel
        invitations={[
          { id: "pending", status: "pending", label: "Pending adult" },
          { id: "expired", status: "expired", label: "Expired adult" },
          { id: "consumed", status: "consumed", label: "Joined adult" },
          { id: "revoked", status: "revoked", label: "Revoked adult" },
        ]}
        hidden={{ teamId: "team-1", returnTo: "/teams/team-1" }}
        includeRole
        createInvitation={() => Promise.resolve({ token: "token" })}
        revokeInvitation={() => undefined}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: "Revoke invitation" }),
    ).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Head coach" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Assistant coach" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "Team manager" })).toBeTruthy();
    expect(screen.getByLabelText("Invitation role")).toHaveProperty(
      "value",
      "HEAD_COACH",
    );
  });

  it("shows action errors and clears an old link when a later create fails", async () => {
    const createInvitation = vi
      .fn<() => Promise<{ token?: string; error?: string }>>()
      .mockResolvedValueOnce({ token: "first-token" })
      .mockResolvedValueOnce({ error: "The invitation could not be created." })
      .mockResolvedValueOnce({});
    render(
      <InvitationPanel
        invitations={[]}
        hidden={{ clubId: "club-1" }}
        includeRole={false}
        createInvitation={createInvitation}
        revokeInvitation={() => undefined}
      />,
    );
    const form = screen
      .getByRole("button", { name: "Create invitation" })
      .closest("form");
    if (!(form instanceof HTMLFormElement))
      throw new Error("Expected invitation form");

    fireEvent.submit(form);
    expect(await screen.findByLabelText("Invitation link")).toHaveProperty(
      "value",
      `${window.location.origin}/invitations/accept#first-token`,
    );

    fireEvent.submit(form);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The invitation could not be created.",
    );
    expect(screen.queryByLabelText("Invitation link")).toBeNull();

    fireEvent.submit(form);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Invitation could not be saved.",
    );
  });

  it("passes the selected invitation id and hidden context to revoke", () => {
    let submitted: FormData | undefined;
    render(
      <InvitationPanel
        invitations={[{ id: "invite-1", status: "pending", label: "Adult" }]}
        hidden={{ teamId: "team-1", returnTo: "/teams/team-1" }}
        includeRole={false}
        createInvitation={() => Promise.resolve({})}
        revokeInvitation={(data) => {
          submitted = data;
        }}
      />,
    );

    const form = screen
      .getByRole("button", { name: "Revoke invitation" })
      .closest("form");
    if (!(form instanceof HTMLFormElement))
      throw new Error("Expected revoke form");
    fireEvent.submit(form);
    expect(submitted?.get("teamId")).toBe("team-1");
    expect(submitted?.get("returnTo")).toBe("/teams/team-1");
    expect(submitted?.get("invitationId")).toBe("invite-1");
  });
});
