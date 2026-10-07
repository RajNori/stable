import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostGameReviewPanel } from "./post-game-review-panel.js";

const review = {
  eventId: "33333333-3333-4333-8333-333333333333",
  clubId: "11111111-1111-4111-8111-111111111111",
  teamId: "22222222-2222-4222-8222-222222222222",
  whatWorked: "Good passing",
  needsImprovement: "Box out",
  focusCodes: ["PASSING" as const],
  completedBy: null,
  completedAt: null,
  recognitions: [],
};
const player = {
  playerId: "44444444-4444-4444-8444-444444444444",
  label: "Jordan R.",
};
const noop = vi.fn();
afterEach(cleanup);

describe("post-game review panel", () => {
  it("shows separate review fields, typed focus and explicit completion action", () => {
    render(
      <PostGameReviewPanel
        review={review}
        players={[player]}
        privateNotes={new Map()}
        canWrite
        canWritePrivateNotes
        saveReviewAction={noop}
        saveRecognitionAction={noop}
        removeRecognitionAction={noop}
        savePrivateNoteAction={noop}
      />,
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: "What worked",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Good passing");
    expect(
      (
        screen.getByRole("textbox", {
          name: "What needs improvement",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Box out");
    expect((screen.getByLabelText("Passing") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      screen.getByRole("button", { name: "Complete review" }),
    ).toBeTruthy();
  });

  it("renders private-note affordance only for an active team coach", () => {
    const { rerender } = render(
      <PostGameReviewPanel
        review={review}
        players={[player]}
        privateNotes={new Map([[player.playerId, "confidence"]])}
        canWrite
        canWritePrivateNotes
        saveReviewAction={noop}
        saveRecognitionAction={noop}
        removeRecognitionAction={noop}
        savePrivateNoteAction={noop}
      />,
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: "Jordan R. private coaching note",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("confidence");
    rerender(
      <PostGameReviewPanel
        review={review}
        players={[player]}
        privateNotes={new Map()}
        canWrite
        canWritePrivateNotes={false}
        saveReviewAction={noop}
        saveRecognitionAction={noop}
        removeRecognitionAction={noop}
        savePrivateNoteAction={noop}
      />,
    );
    expect(
      screen.queryByRole("textbox", {
        name: "Jordan R. private coaching note",
      }),
    ).toBeNull();
    expect(screen.getByText("🔒 Private to coaching staff")).toBeTruthy();
  });

  it("does not expose a public leaderboard or manager mutation surface", () => {
    render(
      <PostGameReviewPanel
        review={review}
        players={[player]}
        privateNotes={new Map()}
        canWrite={false}
        canWritePrivateNotes={false}
        saveReviewAction={noop}
        saveRecognitionAction={noop}
        removeRecognitionAction={noop}
        savePrivateNoteAction={noop}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Save recognition" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
    expect(
      screen.getByText("Staff-facing recognition. This is not a ranking."),
    ).toBeTruthy();
  });

  it("offers every staff-roster player, including one without a linked guardian", () => {
    const unlinked = {
      playerId: "66666666-6666-4666-8666-666666666666",
      label: "Taylor S.",
    };
    render(
      <PostGameReviewPanel
        review={review}
        players={[player, unlinked]}
        privateNotes={new Map()}
        canWrite
        canWritePrivateNotes
        saveReviewAction={noop}
        saveRecognitionAction={noop}
        removeRecognitionAction={noop}
        savePrivateNoteAction={noop}
      />,
    );
    expect(screen.getByRole("option", { name: "Taylor S." })).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "Taylor S. private coaching note" }),
    ).toBeTruthy();
  });
});
