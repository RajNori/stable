import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlayersPanel, type ManagedPlayer } from "./players-panel";

afterEach(() => {
  cleanup();
});

const player: ManagedPlayer = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  firstName: "Alexander",
  lastName: "Robertson",
  registeredName: "Alexander Robertson",
  displayName: "Alexander R.",
  active: true,
  guardians: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      guardianUserId: "55555555-5555-4555-8555-555555555555",
      active: true,
      label: "Local Member",
    },
  ],
};

const noop = () => undefined;

describe("players panel", () => {
  it("shows the registered name and the guardian-safe name on the admin surface", () => {
    render(
      <PlayersPanel
        clubId="11111111-1111-4111-8111-111111111111"
        players={[player]}
        adults={[
          {
            userId: player.guardians[0]?.guardianUserId ?? "",
            displayName: "Local Member",
          },
        ]}
        createPlayer={noop}
        importPlayers={noop}
        updatePlayer={noop}
        deactivatePlayer={noop}
        reactivatePlayer={noop}
        linkGuardian={noop}
        unlinkGuardian={noop}
        invitations={[
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            status: "pending",
            label: "Guardian invitation",
            playerId: player.id,
          },
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            status: "pending",
            label: "Other player invitation",
            playerId: "27272727-2727-4727-8727-272727272727",
          },
        ]}
        createInvitation={() => Promise.resolve({ token: "one-time-token" })}
        revokeInvitation={noop}
      />,
    );

    expect(screen.getByText("Alexander Robertson")).toBeTruthy();
    expect(screen.getByText("Shown to guardians as Alexander R.")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Local Member" })).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Phone")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(document.body.textContent).not.toContain("@");
    expect(screen.getByText("Guardian invitation pending")).toBeTruthy();
    expect(screen.queryByText("Other player invitation pending")).toBeNull();
  });

  it("registers one team and does not show a roster", () => {
    render(
      <PlayersPanel
        clubId="11111111-1111-4111-8111-111111111111"
        players={[{ ...player, teamName: "U14 Boys" }]}
        adults={[]}
        teams={[
          {
            id: "17171717-1717-4717-8717-171717171717",
            name: "U14 Boys",
          },
        ]}
        createPlayer={noop}
        importPlayers={noop}
        updatePlayer={noop}
        deactivatePlayer={noop}
        reactivatePlayer={noop}
        linkGuardian={noop}
        unlinkGuardian={noop}
        registerPlayer={noop}
        unregisterPlayer={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "Register team" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Unregister team" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Jersey")).toBeNull();
    expect(screen.queryByLabelText("Position")).toBeNull();
  });

  it("keeps inactive player and unlinked-guardian actions clear without a club context", () => {
    const guardian = player.guardians[0];
    if (guardian === undefined) throw new Error("Expected guardian fixture");
    render(
      <PlayersPanel
        clubId={null}
        players={[
          {
            ...player,
            active: false,
            teamName: null,
            guardians: [{ ...guardian, active: false }],
          },
        ]}
        adults={[]}
        createPlayer={noop}
        importPlayers={noop}
        updatePlayer={noop}
        deactivatePlayer={noop}
        reactivatePlayer={noop}
        linkGuardian={noop}
        unlinkGuardian={noop}
        error="Player data could not be refreshed."
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "Player data could not be refreshed.",
    );
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getByText("No team")).toBeTruthy();
    expect(screen.getByText("Local Member (unlinked)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlink" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Link guardian" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add player" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import players" })).toBeNull();
  });

  it("explains when no club adults are available for a guardian link", () => {
    render(
      <PlayersPanel
        clubId="11111111-1111-4111-8111-111111111111"
        players={[{ ...player, guardians: [] }]}
        adults={[]}
        createPlayer={noop}
        importPlayers={noop}
        updatePlayer={noop}
        deactivatePlayer={noop}
        reactivatePlayer={noop}
        linkGuardian={noop}
        unlinkGuardian={noop}
      />,
    );
    expect(
      screen.getByText("No club adults are available to link."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link guardian" })).toBeNull();
  });
});
