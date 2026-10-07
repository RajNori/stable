import { describe, expect, it, vi } from "vitest";

import {
  listPrivatePlayerNotes,
  readPostGameReview,
  readPrivatePlayerNote,
  removePlayerRecognition,
  savePlayerRecognition,
  savePostGameReview,
  savePrivatePlayerNote,
  type CoachingReviewAccess,
  type CoachingReviewWriter,
} from "./review-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const playerId = "44444444-4444-4444-8444-444444444444";
const coachId = "55555555-5555-4555-8555-555555555555";

const base: CoachingReviewAccess = {
  principal: { userId: coachId },
  clubMemberships: [],
  teamMemberships: [
    { clubId, teamId, role: "HEAD_COACH", active: true, teamActive: true },
  ],
  guardianLinks: [],
  registrations: [],
  teamActive: true,
};

const review = {
  eventId,
  clubId,
  teamId,
  whatWorked: "Good passing",
  needsImprovement: "Box out",
  focusCodes: ["PASSING" as const],
  completedBy: null,
  completedAt: null,
  recognitions: [],
};

function setup(overrides: Partial<CoachingReviewWriter> = {}) {
  const writer: CoachingReviewWriter = {
    readPostGameReview: vi.fn().mockResolvedValue(review),
    savePostGameReview: vi.fn().mockResolvedValue(undefined),
    savePlayerRecognition: vi.fn().mockResolvedValue(undefined),
    removePlayerRecognition: vi.fn().mockResolvedValue(undefined),
    savePrivatePlayerNote: vi.fn().mockResolvedValue(undefined),
    readPrivatePlayerNote: vi.fn().mockResolvedValue("Private note"),
    listPrivatePlayerNotes: vi
      .fn()
      .mockResolvedValue([{ playerId, note: "Private note" }]),
    ...overrides,
  };
  return { writer };
}

const manager = {
  ...base,
  teamMemberships: [
    {
      clubId,
      teamId,
      role: "TEAM_MANAGER" as const,
      active: true,
      teamActive: true,
    },
  ],
};

describe("post-game review commands", () => {
  it("reads a review only after the review capability is allowed and verifies resource ownership", async () => {
    const { writer } = setup();
    await expect(
      readPostGameReview({ ...base, clubId, teamId, eventId, writer }),
    ).resolves.toEqual(review);
    await expect(
      readPostGameReview({
        ...base,
        teamMemberships: [],
        clubId,
        teamId,
        eventId,
        writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      readPostGameReview({ ...manager, clubId, teamId, eventId, writer }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      readPostGameReview({
        ...base,
        principal: null,
        clubId,
        teamId,
        eventId,
        writer,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });

    for (const mismatched of [
      { ...review, eventId: "66666666-6666-4666-8666-666666666666" },
      { ...review, clubId: "66666666-6666-4666-8666-666666666666" },
      { ...review, teamId: "66666666-6666-4666-8666-666666666666" },
    ]) {
      const mismatchedWriter = setup({
        readPostGameReview: vi.fn().mockResolvedValue(mismatched),
      }).writer;
      await expect(
        readPostGameReview({
          ...base,
          clubId,
          teamId,
          eventId,
          writer: mismatchedWriter,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(writer.readPostGameReview).toHaveBeenCalledOnce();
  });

  it("validates review text, focus choices, identifiers, and forwards explicit draft or completion state", async () => {
    const { writer } = setup();
    await savePostGameReview({
      ...base,
      clubId,
      teamId,
      eventId,
      whatWorked: " Good passing\nTalk early ",
      needsImprovement: "Box out",
      focusCodes: ["PASSING", "DEFENCE"],
      complete: true,
      writer,
    });
    expect(writer.savePostGameReview).toHaveBeenCalledWith({
      eventId,
      whatWorked: "Good passing\nTalk early",
      needsImprovement: "Box out",
      focusCodes: ["PASSING", "DEFENCE"],
      complete: true,
    });
    await savePostGameReview({
      ...base,
      clubId,
      teamId,
      eventId,
      whatWorked: "",
      needsImprovement: "",
      focusCodes: [],
      complete: false,
      writer,
    });

    const invalid = [
      {
        whatWorked: "",
        needsImprovement: "",
        focusCodes: ["PASSING", "PASSING"],
        eventId,
      },
      { whatWorked: "", needsImprovement: "", focusCodes: ["BOGUS"], eventId },
      {
        whatWorked: "x".repeat(2001),
        needsImprovement: "",
        focusCodes: [],
        eventId,
      },
      {
        whatWorked: "bad\ttext",
        needsImprovement: "",
        focusCodes: [],
        eventId,
      },
      {
        whatWorked: "",
        needsImprovement: "",
        focusCodes: [
          "PASSING",
          "DEFENCE",
          "TEAMWORK",
          "TRANSITION",
          "SHOOTING",
          "REBOUNDING",
        ],
        eventId,
      },
      {
        whatWorked: "",
        needsImprovement: "",
        focusCodes: [],
        eventId: "invalid",
      },
    ];
    for (const command of invalid) {
      await expect(
        savePostGameReview({
          ...base,
          clubId,
          teamId,
          ...command,
          complete: false,
          writer,
        } as never),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    }
    await expect(
      savePostGameReview({
        ...base,
        clubId: "invalid",
        teamId,
        eventId,
        whatWorked: "",
        needsImprovement: "",
        focusCodes: [],
        complete: false,
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      savePostGameReview({
        ...manager,
        clubId,
        teamId,
        eventId,
        whatWorked: "",
        needsImprovement: "",
        focusCodes: [],
        complete: false,
        writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writer.savePostGameReview).toHaveBeenCalledTimes(2);
  });

  it("validates recognition, checks writer access, and forwards save and removal", async () => {
    const { writer } = setup();
    await savePlayerRecognition({
      ...base,
      clubId,
      teamId,
      eventId,
      playerId,
      category: "MVP",
      note: null,
      writer,
    });
    expect(writer.savePlayerRecognition).toHaveBeenCalledWith({
      eventId,
      playerId,
      category: "MVP",
      note: null,
    });
    await removePlayerRecognition({
      ...base,
      clubId,
      teamId,
      eventId,
      playerId,
      category: "HUSTLE",
      writer,
    });
    expect(writer.removePlayerRecognition).toHaveBeenCalledWith(
      eventId,
      playerId,
      "HUSTLE",
    );

    const invalid = [
      { playerId, category: "OTHER", note: null },
      { playerId: "invalid", category: "MVP", note: null },
      { playerId, category: "TEAMWORK", note: "x".repeat(501) },
      { playerId, category: "DEFENCE", note: "bad\u0001text" },
      { playerId, category: "HUSTLE", note: 10 },
    ];
    for (const command of invalid) {
      await expect(
        savePlayerRecognition({
          ...base,
          clubId,
          teamId,
          eventId,
          ...command,
          writer,
        } as never),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    }
    await expect(
      savePlayerRecognition({
        ...base,
        clubId,
        teamId,
        eventId: "invalid",
        playerId,
        category: "MVP",
        note: null,
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      savePlayerRecognition({
        ...manager,
        clubId,
        teamId,
        eventId,
        playerId,
        category: "TEAMWORK",
        note: null,
        writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      removePlayerRecognition({
        ...base,
        clubId,
        teamId,
        eventId,
        playerId: "invalid",
        category: "MVP",
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      removePlayerRecognition({
        ...base,
        clubId,
        teamId,
        eventId,
        playerId,
        category: "INVALID" as never,
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      removePlayerRecognition({
        ...manager,
        clubId,
        teamId,
        eventId,
        playerId,
        category: "MVP",
        writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writer.savePlayerRecognition).toHaveBeenCalledOnce();
    expect(writer.removePlayerRecognition).toHaveBeenCalledOnce();
  });

  it("keeps private notes on dedicated read, list, save, and clear writer paths", async () => {
    const { writer } = setup();
    await expect(
      readPrivatePlayerNote({
        ...base,
        clubId,
        teamId,
        eventId,
        playerId,
        writer,
      }),
    ).resolves.toBe("Private note");
    await expect(
      listPrivatePlayerNotes({ ...base, clubId, teamId, eventId, writer }),
    ).resolves.toEqual([{ playerId, note: "Private note" }]);
    await savePrivatePlayerNote({
      ...base,
      clubId,
      teamId,
      eventId,
      playerId,
      note: "Needs confidence",
      writer,
    });
    await savePrivatePlayerNote({
      ...base,
      clubId,
      teamId,
      eventId,
      playerId,
      note: null,
      writer,
    });
    expect(writer.readPrivatePlayerNote).toHaveBeenCalledWith(
      eventId,
      playerId,
    );
    expect(writer.listPrivatePlayerNotes).toHaveBeenCalledWith(eventId);
    expect(writer.savePrivatePlayerNote).toHaveBeenNthCalledWith(1, {
      eventId,
      playerId,
      note: "Needs confidence",
    });
    expect(writer.savePrivatePlayerNote).toHaveBeenNthCalledWith(2, {
      eventId,
      playerId,
      note: null,
    });

    const dualRole = {
      ...base,
      clubMemberships: [{ clubId, role: "CLUB_ADMIN" as const, active: true }],
    };
    await savePrivatePlayerNote({
      ...dualRole,
      clubId,
      teamId,
      eventId,
      playerId,
      note: "Coach membership grants access",
      writer,
    });
    await expect(
      savePrivatePlayerNote({
        ...dualRole,
        teamMemberships: [],
        clubId,
        teamId,
        eventId,
        playerId,
        note: "Hidden",
        writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const guardian = {
      ...base,
      teamMemberships: [],
      guardianLinks: [{ clubId, playerId, active: true, playerActive: true }],
      registrations: [
        { clubId, teamId, playerId, active: true, teamActive: true },
      ],
    };
    await expect(
      savePrivatePlayerNote({
        ...guardian,
        clubId,
        teamId,
        eventId,
        playerId,
        note: "private",
        writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      readPrivatePlayerNote({
        ...manager,
        clubId,
        teamId,
        eventId,
        playerId,
        writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      listPrivatePlayerNotes({ ...manager, clubId, teamId, eventId, writer }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      readPrivatePlayerNote({
        ...base,
        clubId,
        teamId,
        eventId,
        playerId: "invalid",
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      savePrivatePlayerNote({
        ...base,
        clubId,
        teamId,
        eventId,
        playerId: "invalid",
        note: null,
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      savePrivatePlayerNote({
        ...base,
        clubId,
        teamId,
        eventId,
        playerId,
        note: "x".repeat(2001),
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      savePrivatePlayerNote({
        ...base,
        clubId,
        teamId,
        eventId,
        playerId,
        note: "bad\u007ftext",
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      listPrivatePlayerNotes({
        ...base,
        clubId: "invalid",
        teamId,
        eventId,
        writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(writer.readPrivatePlayerNote).toHaveBeenCalledTimes(1);
    expect(writer.listPrivatePlayerNotes).toHaveBeenCalledTimes(1);
  });
});
