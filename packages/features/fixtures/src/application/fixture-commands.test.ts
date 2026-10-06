import { ApplicationError } from "@stable/contracts";
import type {
  MembershipFact,
  Principal,
  TeamMembershipFact,
} from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  createManualFixture,
  fixtureOverlaySchema,
  importFixture,
  listTeamFixtures,
  officialFixtureSchema,
  officialFixtureUpdateSchema,
  readFixture,
  updateFixtureOverlay,
  updateOfficialFixture,
} from "./fixture-commands.js";
import type {
  FixtureAccess,
  FixtureOverlay,
  FixtureRecord,
  FixtureWriter,
  ImportedFixture,
  OfficialFixture,
  OfficialFixtureUpdate,
} from "./fixture-commands.js";
import { fixtureMessages } from "./fixture-messages.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const otherClubId = "22222222-2222-4222-8222-222222222222";
const teamId = "33333333-3333-4333-8333-333333333333";
const otherTeamId = "44444444-4444-4444-8444-444444444444";
const eventId = "55555555-5555-4555-8555-555555555555";
const principal: Principal = {
  userId: "66666666-6666-4666-8666-666666666666",
};
const startsAt = "2026-10-10T07:30:00.000Z";
const endsAt = "2026-10-10T09:00:00.000Z";

function manager(team = teamId, active = true): TeamMembershipFact {
  return {
    clubId,
    teamId: team,
    role: "TEAM_MANAGER",
    active,
    teamActive: true,
  };
}

function access(facts: Partial<FixtureAccess> = {}): FixtureAccess {
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [manager()],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
    ...facts,
  };
}

function official(): OfficialFixture {
  return {
    clubId,
    teamId,
    startsAt,
    endsAt,
    venueId: null,
    courtLabel: "  Court 1  ",
    competitionId: null,
    roundLabel: " Round 1 ",
    opponentName: " Visitors ",
    officialStartAt: startsAt,
    officialVenueText: " Home ",
    officialCourtLabel: "",
    homeAway: "HOME",
  };
}

function record(team = teamId): FixtureRecord {
  return {
    eventId,
    clubId,
    teamId: team,
    startsAt,
    endsAt,
    venueId: null,
    courtLabel: "Court 1",
    eventStatus: "SCHEDULED",
    competitionId: null,
    roundLabel: "Round 1",
    opponentName: "Visitors",
    source: "MANUAL",
    externalId: null,
    officialStartAt: startsAt,
    officialVenueText: "Home",
    officialCourtLabel: null,
    fixtureStatus: "SCHEDULED",
    homeAway: "HOME",
    teamScore: null,
    opponentScore: null,
    resultStatus: null,
    lastExternalSyncAt: null,
    arrivalAt: null,
    uniformNote: null,
    coachFocus: null,
    teamNote: null,
  };
}

function writer(): FixtureWriter & {
  calls: string[];
  manual: OfficialFixture | null;
  imported: ImportedFixture | null;
  officialUpdate: OfficialFixtureUpdate | null;
  overlay: FixtureOverlay | null;
} {
  const calls: string[] = [];
  const state: {
    manual: OfficialFixture | null;
    imported: ImportedFixture | null;
    officialUpdate: OfficialFixtureUpdate | null;
    overlay: FixtureOverlay | null;
  } = {
    manual: null,
    imported: null,
    officialUpdate: null,
    overlay: null,
  };
  return {
    calls,
    get manual() {
      return state.manual;
    },
    get imported() {
      return state.imported;
    },
    get officialUpdate() {
      return state.officialUpdate;
    },
    get overlay() {
      return state.overlay;
    },
    createManualFixture: (command) => {
      calls.push("manual");
      state.manual = command;
      return Promise.resolve({ eventId });
    },
    importFixture: (command) => {
      calls.push("import");
      state.imported = command;
      return Promise.resolve({ eventId });
    },
    updateOfficialFixture: (command) => {
      calls.push("official");
      state.officialUpdate = command;
      return Promise.resolve();
    },
    updateFixtureOverlay: (command) => {
      calls.push("overlay");
      state.overlay = command;
      return Promise.resolve();
    },
    readFixture: () => Promise.resolve(record()),
    listTeamFixtures: () => Promise.resolve([record()]),
  };
}

const admin: MembershipFact = {
  clubId,
  role: "CLUB_ADMIN",
  active: true,
};

describe("fixture commands", () => {
  it("keeps official fields and overlay fields on separate contracts", () => {
    expect(
      officialFixtureSchema.safeParse({ ...official(), arrivalAt: startsAt })
        .success,
    ).toBe(false);
    expect(
      officialFixtureUpdateSchema.safeParse({
        ...official(),
        eventId,
        fixtureStatus: "SCHEDULED",
        teamScore: null,
        opponentScore: null,
        resultStatus: null,
        coachFocus: "Press",
      }).success,
    ).toBe(false);
    expect(
      fixtureOverlaySchema.safeParse({
        eventId,
        arrivalAt: startsAt,
        uniformNote: null,
        coachFocus: null,
        teamNote: null,
        opponentName: "Visitors",
      }).success,
    ).toBe(false);
  });

  it("creates a manual fixture for a team manager and trims text", async () => {
    const saved = writer();
    const created = await createManualFixture({
      ...access(),
      ...official(),
      writer: saved,
    });

    expect(created.eventId).toBe(eventId);
    expect(saved.calls).toEqual(["manual"]);
    expect(saved.manual?.opponentName).toBe("Visitors");
    expect(saved.manual?.courtLabel).toBe("Court 1");
    expect(saved.manual?.officialCourtLabel).toBeNull();
    expect(saved.manual).not.toHaveProperty("arrivalAt");
    expect(saved.manual).not.toHaveProperty("externalId");
  });

  it("imports through the same official contract with an external id", async () => {
    const saved = writer();
    await importFixture({
      ...access({ clubMemberships: [admin], teamMemberships: [] }),
      ...official(),
      externalId: " ext-1 ",
      writer: saved,
    });

    expect(saved.calls).toEqual(["import"]);
    expect(saved.imported?.externalId).toBe("ext-1");
    expect(saved.imported).not.toHaveProperty("source");
    expect(saved.imported).not.toHaveProperty("uniformNote");
  });

  it("rejects an import without an external id before writing", async () => {
    const saved = writer();
    await expect(
      importFixture({
        ...access(),
        ...official(),
        externalId: " ",
        writer: saved,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: fixtureMessages.validationFailed,
    });
    expect(saved.calls).toEqual([]);
  });

  it("rejects inverted times and a blank opponent before writing", async () => {
    const saved = writer();
    await expect(
      createManualFixture({
        ...access(),
        ...official(),
        endsAt: startsAt,
        writer: saved,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createManualFixture({
        ...access(),
        ...official(),
        opponentName: " ",
        writer: saved,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createManualFixture({
        ...access(),
        ...official(),
        opponentName: "Bad\nName",
        writer: saved,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(saved.calls).toEqual([]);
  });

  it("denies official writes to a head coach, assistant, guardian, outsider, and revoked admin", async () => {
    const saved = writer();
    const cases: FixtureAccess[] = [
      access({
        teamMemberships: [{ ...manager(), role: "HEAD_COACH" }],
      }),
      access({
        teamMemberships: [{ ...manager(), role: "ASSISTANT_COACH" }],
      }),
      access({
        teamMemberships: [],
        guardianLinks: [
          {
            clubId,
            playerId: "77777777-7777-4777-8777-777777777777",
            active: true,
            playerActive: true,
          },
        ],
        registrations: [
          {
            clubId,
            teamId,
            playerId: "77777777-7777-4777-8777-777777777777",
            active: true,
            teamActive: true,
          },
        ],
      }),
      access({ teamMemberships: [] }),
      access({
        clubMemberships: [{ ...admin, active: false }],
        teamMemberships: [],
      }),
      access({
        clubMemberships: [{ ...admin, clubId: otherClubId }],
        teamMemberships: [],
      }),
      access({ teamMemberships: [manager(otherTeamId)] }),
      access({ teamActive: false }),
      access({ principal: null }),
    ];

    for (const actor of cases) {
      await expect(
        createManualFixture({ ...actor, ...official(), writer: saved }),
      ).rejects.toBeInstanceOf(ApplicationError);
    }
    expect(saved.calls).toEqual([]);
    await expect(
      createManualFixture({
        ...access({ principal: null }),
        ...official(),
        writer: saved,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("updates official fields without overlay fields", async () => {
    const saved = writer();
    await updateOfficialFixture({
      ...access(),
      ...official(),
      eventId,
      fixtureStatus: "POSTPONED",
      teamScore: 12,
      opponentScore: 8,
      resultStatus: "FINAL",
      writer: saved,
    });

    expect(saved.calls).toEqual(["official"]);
    expect(saved.officialUpdate?.fixtureStatus).toBe("POSTPONED");
    expect(saved.officialUpdate?.teamScore).toBe(12);
    expect(saved.officialUpdate).not.toHaveProperty("arrivalAt");
    expect(saved.officialUpdate).not.toHaveProperty("coachFocus");
  });

  it("lets a head coach update the overlay and denies an assistant", async () => {
    const saved = writer();
    await expect(
      updateFixtureOverlay({
        ...access({
          teamMemberships: [{ ...manager(), role: "ASSISTANT_COACH" }],
        }),
        clubId,
        teamId,
        eventId,
        arrivalAt: startsAt,
        uniformNote: " White ",
        coachFocus: "",
        teamNote: null,
        writer: saved,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await updateFixtureOverlay({
      ...access({
        teamMemberships: [{ ...manager(), role: "HEAD_COACH" }],
      }),
      clubId,
      teamId,
      eventId,
      arrivalAt: startsAt,
      uniformNote: " White ",
      coachFocus: "",
      teamNote: null,
      writer: saved,
    });

    expect(saved.calls).toEqual(["overlay"]);
    expect(saved.overlay?.uniformNote).toBe("White");
    expect(saved.overlay?.coachFocus).toBeNull();
    expect(saved.overlay).not.toHaveProperty("opponentName");
    expect(saved.overlay).not.toHaveProperty("teamScore");
  });

  it("lets a guardian read one team and hides a fixture from another team", async () => {
    const saved = writer();
    const guardian = access({
      teamMemberships: [],
      guardianLinks: [
        {
          clubId,
          playerId: "77777777-7777-4777-8777-777777777777",
          active: true,
          playerActive: true,
        },
      ],
      registrations: [
        {
          clubId,
          teamId,
          playerId: "77777777-7777-4777-8777-777777777777",
          active: true,
          teamActive: true,
        },
      ],
    });
    const listed = await listTeamFixtures({
      ...guardian,
      clubId,
      teamId,
      writer: saved,
    });
    expect(listed).toHaveLength(1);
    const read = await readFixture({
      ...guardian,
      clubId,
      teamId,
      eventId,
      writer: saved,
    });
    expect(read.eventId).toBe(eventId);

    saved.readFixture = () => Promise.resolve(record(otherTeamId));
    await expect(
      readFixture({
        ...guardian,
        clubId,
        teamId,
        eventId,
        writer: saved,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: fixtureMessages.notFound,
    });
    saved.listTeamFixtures = () => Promise.resolve([record(otherTeamId)]);
    await expect(
      listTeamFixtures({
        ...guardian,
        clubId,
        teamId,
        writer: saved,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
