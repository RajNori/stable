import { playerMessages } from "@stable/players";
import { describe, expect, it } from "vitest";

import { playerPageError } from "./player-page-error";

describe("player page errors", () => {
  it("shows only an allowlisted sentence and row numbers", () => {
    expect(playerPageError(playerMessages.importValidationFailed, "2,4")).toBe(
      "Player import failed validation. Check row 2. Check row 4.",
    );
    expect(playerPageError(playerMessages.notFound, undefined)).toBe(
      "Player record was not found.",
    );
  });

  it("drops child names and any row text that is not a row number", () => {
    expect(playerPageError("Alexander Robertson", "1")).toBeUndefined();
    expect(
      playerPageError(playerMessages.importValidationFailed, "Alexander"),
    ).toBe(playerMessages.importValidationFailed);
    expect(playerPageError(playerMessages.notFound, "2")).toBe(
      playerMessages.notFound,
    );
  });
});
