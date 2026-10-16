import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLAYER_IMPORT_MAX_ROWS } from "@stable/contracts";

import { PlayerImportForm } from "./player-import-form";

afterEach(cleanup);

describe("player import form", () => {
  it("adds, edits, submits, and removes rows without losing the remaining values", async () => {
    const action = vi.fn();
    render(<PlayerImportForm clubId="club-1" action={action} />);

    expect(screen.getByRole("group", { name: "Import row 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove row" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.change(screen.getByLabelText("Given name"), {
      target: { value: "Taylor" },
    });
    fireEvent.change(screen.getByLabelText("Surname"), {
      target: { value: "Morgan" },
    });
    fireEvent.change(screen.getByLabelText("Source id"), {
      target: { value: "provider-123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(screen.getByRole("group", { name: "Import row 2" })).toBeTruthy();
    fireEvent.change(
      screen.getByLabelText("Given name", { selector: "input#import-first-1" }),
      {
        target: { value: "Jordan" },
      },
    );
    const form = screen
      .getByRole("button", { name: "Import players" })
      .closest("form");
    if (!(form instanceof HTMLFormElement))
      throw new Error("Expected import form");
    fireEvent.submit(form);
    const rows = JSON.parse(new FormData(form).get("rows") as string) as Array<{
      firstName: string;
      lastName: string;
      sourcePlayerId: string;
    }>;
    expect(new FormData(form).get("clubId")).toBe("club-1");
    expect(rows).toEqual([
      {
        firstName: "Taylor",
        lastName: "Morgan",
        sourcePlayerId: "provider-123",
      },
      { firstName: "Jordan", lastName: "", sourcePlayerId: "" },
    ]);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Remove row" }));
    expect(screen.queryByRole("group", { name: "Import row 2" })).toBeNull();
    expect(screen.getByLabelText("Given name")).toHaveProperty(
      "value",
      "Taylor",
    );
  });

  it("stops adding rows at the supported import limit", () => {
    render(<PlayerImportForm clubId="club-1" action={() => undefined} />);
    const add = screen.getByRole("button", { name: "Add row" });
    for (let index = 1; index < PLAYER_IMPORT_MAX_ROWS; index += 1) {
      if ((add as HTMLButtonElement).disabled) break;
      fireEvent.click(add);
    }

    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("group", { name: /^Import row/ })).toHaveLength(
      PLAYER_IMPORT_MAX_ROWS,
    );
  });
});
