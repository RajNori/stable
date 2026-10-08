import React from "react";
import { AccessibilityInfo } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { gameDaySnapshotFromProjection } from "./game-day-snapshot";
import { OfflineGameDayView } from "./offline-game-day-view";
import type { GameDayProjection } from "@stable/game-day";

type AccessibilitySpy = {
  mockImplementation: (
    implementation: (message: string) => void,
  ) => AccessibilitySpy;
  mockRestore: () => void;
};

declare const jest: {
  spyOn: (
    object: typeof AccessibilityInfo,
    method: "announceForAccessibility",
  ) => AccessibilitySpy;
};

const projection: GameDayProjection = {
  eventId: "55555555-5555-4555-8555-555555555555",
  clubId: "11111111-1111-4111-8111-111111111111",
  teamId: "99999999-9999-4999-8999-999999999999",
  opponentName: "Visitors",
  roundLabel: "Round 1",
  officialStartAt: "2026-10-10T07:30:00.000Z",
  arrivalAt: null,
  venueText: "Home",
  courtLabel: "Court 1",
  uniformNote: "White",
  coachFocus: "Press",
  ownRsvp: "ATTENDING",
  ownDutyLabel: "Scorebook",
  ownDutyStatus: "ASSIGNED",
  fillInLabel: null,
  attendingCount: null,
  unavailableCount: null,
  unsureCount: null,
  unansweredCount: null,
};

describe("offline game day view", () => {
  it("shows the saved time and disables writes", async () => {
    const announcements: string[] = [];
    const announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation((message) => {
        announcements.push(message);
      });
    const snapshot = gameDaySnapshotFromProjection({
      userId: "19191919-1919-4919-8919-191919191919",
      teamName: "U14 Boys",
      projection,
      savedAt: "2026-10-07T01:00:00.000Z",
    });
    await render(
      <OfflineGameDayView
        snapshot={snapshot}
        now={Date.parse("2026-10-07T08:00:00.000Z")}
      />,
    );
    expect(
      screen.getByText("Offline · Last updated 2026-10-07T01:00:00.000Z").props
        .accessibilityLiveRegion,
    ).toBe("polite");
    expect(
      screen.getByText("This snapshot is stale.").props.accessibilityLiveRegion,
    ).toBe("polite");
    expect(
      screen.getByRole("header", { name: "U14 Boys: Visitors" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Reconnect to update RSVP, attendance, fixtures, duties, or check-in.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Save RSVP").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.queryByText(/Fever/)).toBeNull();
    expect(
      announcements.includes(
        "Offline. Last updated 2026-10-07T01:00:00.000Z. This snapshot is stale.",
      ),
    ).toBe(true);
    announce.mockRestore();
  });
});
