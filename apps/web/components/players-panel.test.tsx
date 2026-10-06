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
      />,
    );

    expect(screen.getByText("Alexander Robertson")).toBeTruthy();
    expect(screen.getByText("Shown to guardians as Alexander R.")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Local Member" })).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Phone")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(document.body.textContent).not.toContain("@");
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
});
