import { describe, expect, it } from "vitest";

import { countActivePlayersMissingGuardian } from "./club-admin-player-coverage";

describe("countActivePlayersMissingGuardian", () => {
  it("counts active players without an active guardian and ignores inactive players", () => {
    expect(
      countActivePlayersMissingGuardian(
        [
          { id: "player-one", active: true },
          { id: "player-two", active: true },
          { id: "player-three", active: false },
        ],
        new Set(["player-two"]),
      ),
    ).toBe(1);
  });

  it("returns zero when every active player has an active guardian", () => {
    expect(
      countActivePlayersMissingGuardian(
        [
          { id: "player-one", active: true },
          { id: "player-two", active: true },
        ],
        new Set(["player-one", "player-two"]),
      ),
    ).toBe(0);
  });
});
