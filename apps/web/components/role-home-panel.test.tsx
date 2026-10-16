import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoleHomePanel } from "./role-home-panel";

afterEach(cleanup);

describe("role home panel", () => {
  it("requires an explicit team when the adult has several contexts", () => {
    render(
      <RoleHomePanel
        role={null}
        availableRoles={[]}
        teams={[
          { id: "team-a", name: "U14 Boys" },
          { id: "team-b", name: "U12 Girls" },
        ]}
        selectedTeam={null}
        nextGame={null}
        nextTraining={null}
        gameDay={null}
        latestAnnouncement={null}
        timezone="Australia/Melbourne"
        themeKey="mustangs"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Choose your team" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "U14 Boys" }).getAttribute("href"),
    ).toBe("/?team=team-a");
    expect(
      screen.getByRole("link", { name: "U12 Girls" }).getAttribute("href"),
    ).toBe("/?team=team-b");
  });

  it("shows a Guardian their RSVP and duty without coaching-private data", () => {
    render(
      <RoleHomePanel
        role="Guardian"
        availableRoles={["Head Coach", "Guardian"]}
        teams={[{ id: "team-a", name: "U14 Boys" }]}
        selectedTeam={{ id: "team-a", name: "U14 Boys" }}
        nextGame={{
          eventId: "11111111-1111-4111-8111-111111111111",
          clubId: "22222222-2222-4222-8222-222222222222",
          teamId: "33333333-3333-4333-8333-333333333333",
          eventType: "GAME",
          startsAt: "2026-10-17T00:30:00.000Z",
          endsAt: null,
          courtLabel: "Court 2",
          eventStatus: "SCHEDULED",
          opponentName: "Visitors",
          roundLabel: "Round 4",
        }}
        nextTraining={{
          eventId: "44444444-4444-4444-8444-444444444444",
          clubId: "22222222-2222-4222-8222-222222222222",
          teamId: "33333333-3333-4333-8333-333333333333",
          eventType: "TRAINING",
          startsAt: "2026-10-20T07:00:00.000Z",
          endsAt: null,
          courtLabel: null,
          eventStatus: "SCHEDULED",
          opponentName: null,
          roundLabel: null,
        }}
        latestAnnouncement={{
          id: "55555555-5555-4555-8555-555555555555",
          clubId: "22222222-2222-4222-8222-222222222222",
          teamId: "33333333-3333-4333-8333-333333333333",
          authorUserId: "66666666-6666-4666-8666-666666666666",
          category: "GENERAL",
          importance: "NORMAL",
          title: "Court changed",
          body: "Please use Court 2.",
          acknowledgementRequired: true,
          publishedAt: "2026-10-16T00:00:00.000Z",
          archivedAt: null,
          readAt: null,
          acknowledgedAt: null,
        }}
        gameDay={{
          eventId: "11111111-1111-4111-8111-111111111111",
          clubId: "22222222-2222-4222-8222-222222222222",
          teamId: "33333333-3333-4333-8333-333333333333",
          opponentName: "Visitors",
          roundLabel: "Round 4",
          officialStartAt: "2026-10-17T00:30:00.000Z",
          arrivalAt: "2026-10-17T00:00:00.000Z",
          venueText: "Main court",
          courtLabel: "Court 2",
          uniformNote: null,
          coachFocus: null,
          ownRsvp: "ATTENDING",
          ownDutyLabel: "Scorer",
          ownDutyStatus: "ASSIGNED",
          fillInLabel: null,
          attendingCount: null,
          unavailableCount: null,
          unsureCount: null,
          unansweredCount: null,
        }}
        timezone="Australia/Melbourne"
        themeKey="mustangs"
      />,
    );

    expect(
      screen.getByText(/RSVP: attending · Your duty: Scorer/),
    ).toBeTruthy();
    expect(screen.getByText(/Arrive/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Team roster" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Head Coach" }).getAttribute("href"),
    ).toBe("/?team=team-a&view=head-coach");
    expect(screen.getByRole("heading", { name: "Next training" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Latest update" })).toBeTruthy();
    expect(screen.getByText("Court changed")).toBeTruthy();
    expect(screen.getByText("Response requested")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Game Day operations" }),
    ).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Coaching tools" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open training" }).getAttribute("href"),
    ).toBe("/teams/team-a/training");
    expect(
      screen.queryByText(/private|coach focus|development review/i),
    ).toBeNull();
  });

  it("shows staff availability, own duty and safe fill-in state", () => {
    render(
      <RoleHomePanel
        role="Assistant Coach"
        availableRoles={["Assistant Coach"]}
        teams={[{ id: "team-a", name: "U14 Boys" }]}
        selectedTeam={{ id: "team-a", name: "U14 Boys" }}
        nextGame={{
          eventId: "11111111-1111-4111-8111-111111111111",
          clubId: "22222222-2222-4222-8222-222222222222",
          teamId: "33333333-3333-4333-8333-333333333333",
          eventType: "GAME",
          startsAt: "2026-10-17T00:30:00.000Z",
          endsAt: null,
          courtLabel: "Court 2",
          eventStatus: "SCHEDULED",
          opponentName: "Visitors",
          roundLabel: "Round 4",
        }}
        nextTraining={null}
        gameDay={{
          eventId: "11111111-1111-4111-8111-111111111111",
          clubId: "22222222-2222-4222-8222-222222222222",
          teamId: "33333333-3333-4333-8333-333333333333",
          opponentName: "Visitors",
          roundLabel: "Round 4",
          officialStartAt: "2026-10-17T00:30:00.000Z",
          arrivalAt: null,
          venueText: null,
          courtLabel: "Court 2",
          uniformNote: null,
          coachFocus: "Private plan context",
          ownRsvp: "UNANSWERED",
          ownDutyLabel: "Scorer",
          ownDutyStatus: "ASSIGNED",
          fillInLabel: "Player R.",
          attendingCount: 6,
          unavailableCount: 1,
          unsureCount: 2,
          unansweredCount: 3,
        }}
        latestAnnouncement={null}
        timezone="Australia/Melbourne"
        themeKey="mustangs"
      />,
    );

    expect(screen.getByText("Attending: 6")).toBeTruthy();
    expect(screen.getByText("Unavailable: 1")).toBeTruthy();
    expect(screen.getByText("Unsure: 2")).toBeTruthy();
    expect(screen.getByText("3 unanswered RSVP(s)")).toBeTruthy();
    expect(screen.getByText("Your duty: Scorer (ASSIGNED)")).toBeTruthy();
    expect(screen.getByText("Confirmed fill-in: Player R.")).toBeTruthy();
    expect(screen.queryByText("Private plan context")).toBeNull();
    const coachingTools = screen.getByRole("navigation", {
      name: "Coaching tools",
    });
    expect(
      screen
        .getByRole("link", { name: "Training and practice plans" })
        .getAttribute("href"),
    ).toBe("/teams/team-a/training");
    expect(
      screen
        .getByRole("link", { name: "Game Day, stats and review" })
        .getAttribute("href"),
    ).toBe("/teams/team-a/games/11111111-1111-4111-8111-111111111111");
    expect(coachingTools).toBeTruthy();
  });

  it("keeps role switching explicit when one adult has several team roles", () => {
    render(
      <RoleHomePanel
        role="Assistant Coach"
        availableRoles={[
          "Head Coach",
          "Assistant Coach",
          "Team Manager",
          "Guardian",
        ]}
        teams={[{ id: "team-a", name: "U14 Boys" }]}
        selectedTeam={{ id: "team-a", name: "U14 Boys" }}
        nextGame={null}
        nextTraining={null}
        gameDay={null}
        latestAnnouncement={null}
        timezone="Australia/Melbourne"
        themeKey="mustangs"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Head Coach" }).getAttribute("href"),
    ).toBe("/?team=team-a&view=head-coach");
    expect(
      screen.getByRole("link", { name: "Team Manager" }).getAttribute("href"),
    ).toBe("/?team=team-a&view=team-manager");
    expect(
      screen.getByRole("link", { name: "Guardian" }).getAttribute("href"),
    ).toBe("/?team=team-a&view=guardian");
  });

  it("shows Team Managers count-only duty, swap and fill-in status", () => {
    render(
      <RoleHomePanel
        role="Team Manager"
        availableRoles={["Team Manager"]}
        teams={[{ id: "team-a", name: "U14 Boys" }]}
        selectedTeam={{ id: "team-a", name: "U14 Boys" }}
        nextGame={{
          eventId: "11111111-1111-4111-8111-111111111111",
          clubId: "22222222-2222-4222-8222-222222222222",
          teamId: "33333333-3333-4333-8333-333333333333",
          eventType: "GAME",
          startsAt: "2026-10-17T00:30:00.000Z",
          endsAt: null,
          courtLabel: null,
          eventStatus: "SCHEDULED",
          opponentName: "Visitors",
          roundLabel: null,
        }}
        nextTraining={null}
        gameDay={{
          eventId: "11111111-1111-4111-8111-111111111111",
          clubId: "22222222-2222-4222-8222-222222222222",
          teamId: "33333333-3333-4333-8333-333333333333",
          opponentName: "Visitors",
          roundLabel: null,
          officialStartAt: "2026-10-17T00:30:00.000Z",
          arrivalAt: null,
          venueText: null,
          courtLabel: null,
          uniformNote: null,
          coachFocus: "Private coaching focus",
          ownRsvp: "UNANSWERED",
          ownDutyLabel: null,
          ownDutyStatus: null,
          fillInLabel: null,
          attendingCount: 3,
          unavailableCount: 1,
          unsureCount: 0,
          unansweredCount: 2,
        }}
        managerOperations={{
          unassignedDutyCount: 1,
          assignedDutyCount: 2,
          acknowledgedDutyCount: 1,
          pendingDutyAcknowledgementCount: 1,
          openDutySwapCount: 1,
          openFillInRequestCount: 1,
          openFillInResponseCount: 2,
          confirmedFillInCount: 0,
        }}
        latestAnnouncement={null}
        timezone="Australia/Melbourne"
        themeKey="mustangs"
      />,
    );

    expect(screen.getByText("Duties: 2 assigned, 1 unassigned")).toBeTruthy();
    expect(screen.getByText("2 unanswered RSVP(s)")).toBeTruthy();
    expect(screen.getByText("Attending: 3")).toBeTruthy();
    expect(screen.getByText("Unavailable: 1")).toBeTruthy();
    expect(screen.queryByText("Private coaching focus")).toBeNull();
    expect(
      screen.getByText("Duty acknowledgements: 1 of 2 complete; 1 pending"),
    ).toBeTruthy();
    expect(screen.getByText("Open duty swaps: 1")).toBeTruthy();
    expect(
      screen.getByText("Fill-in needs: 1 open; 2 responses; 0 confirmed"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("navigation", { name: "Coaching tools" }),
    ).toBeNull();
  });
});
