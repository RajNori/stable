import { describe, expect, it, vi } from "vitest";

import {
  readPostGameReview,
  savePostGameReview,
  savePlayerRecognition,
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
  teamMemberships: [{ clubId, teamId, role: "HEAD_COACH", active: true, teamActive: true }],
  guardianLinks: [],
  registrations: [],
  teamActive: true,
};

const review = {
  eventId, clubId, teamId, whatWorked: "Good passing", needsImprovement: "Box out",
  focusCodes: ["PASSING" as const], completedBy: null, completedAt: null,
  recognitions: [],
};

function setup(overrides: Partial<CoachingReviewWriter> = {}) {
  const writer: CoachingReviewWriter = {
    readPostGameReview: vi.fn().mockResolvedValue(review),
    savePostGameReview: vi.fn().mockResolvedValue(undefined),
    savePlayerRecognition: vi.fn().mockResolvedValue(undefined),
    removePlayerRecognition: vi.fn().mockResolvedValue(undefined),
    savePrivatePlayerNote: vi.fn().mockResolvedValue(undefined),
    readPrivatePlayerNote: vi.fn().mockResolvedValue(null),
    listPrivatePlayerNotes: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  return { writer };
}

describe("post-game review commands", () => {
  it("reads a review only after the review capability is allowed", async () => {
    const { writer } = setup();
    await expect(readPostGameReview({ ...base, clubId, teamId, eventId, writer })).resolves.toEqual(review);
    await expect(readPostGameReview({ ...base, teamMemberships: [], clubId, teamId, eventId, writer })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const manager = { ...base, teamMemberships: [{ clubId, teamId, role: "TEAM_MANAGER" as const, active: true, teamActive: true }] };
    await expect(readPostGameReview({ ...manager, clubId, teamId, eventId, writer })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates focus cardinality and forwards explicit completion", async () => {
    const { writer } = setup();
    await savePostGameReview({ ...base, clubId, teamId, eventId, whatWorked: " Good passing\nTalk early ", needsImprovement: "Box out", focusCodes: ["PASSING", "DEFENCE"], complete: true, writer });
    expect(writer.savePostGameReview).toHaveBeenCalledWith(expect.objectContaining({ whatWorked: "Good passing\nTalk early", complete: true }));
    await expect(savePostGameReview({ ...base, clubId, teamId, eventId, whatWorked: "", needsImprovement: "", focusCodes: ["PASSING", "PASSING"], complete: false, writer })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(savePostGameReview({ ...base, clubId, teamId, eventId, whatWorked: "x".repeat(2001), needsImprovement: "", focusCodes: [], complete: false, writer })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("allows a dual-role club admin private note only through the active coach membership", async () => {
    const { writer } = setup();
    const dualRole = { ...base, clubMemberships: [{ clubId, role: "CLUB_ADMIN" as const, active: true }] };
    await savePrivatePlayerNote({ ...dualRole, clubId, teamId, eventId, playerId, note: "Needs confidence", writer });
    await expect(savePrivatePlayerNote({ ...dualRole, teamMemberships: [], clubId, teamId, eventId, playerId, note: "Hidden", writer })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies a guardian private-note write and never asks the review writer for note text", async () => {
    const { writer } = setup();
    const guardian = { ...base, teamMemberships: [], guardianLinks: [{ clubId, playerId, active: true, playerActive: true }], registrations: [{ clubId, teamId, playerId, active: true, teamActive: true }] };
    await expect(savePrivatePlayerNote({ ...guardian, clubId, teamId, eventId, playerId, note: "private", writer })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writer.readPostGameReview).not.toHaveBeenCalled();
  });

  it("validates recognition categories and note bounds before writing", async () => {
    const { writer } = setup();
    await savePlayerRecognition({ ...base, clubId, teamId, eventId, playerId, category: "MVP", note: null, writer });
    expect(writer.savePlayerRecognition).toHaveBeenCalledWith(expect.objectContaining({ category: "MVP", note: null }));
    await expect(savePlayerRecognition({ ...base, clubId, teamId, eventId, playerId, category: "OTHER" as never, note: "", writer })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(savePlayerRecognition({ ...base, clubId, teamId, eventId, playerId, category: "TEAMWORK", note: "x".repeat(501), writer })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const manager = { ...base, teamMemberships: [{ clubId, teamId, role: "TEAM_MANAGER" as const, active: true, teamActive: true }] };
    await expect(savePlayerRecognition({ ...manager, clubId, teamId, eventId, playerId, category: "TEAMWORK", note: null, writer })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates private note length before the private gateway is called", async () => {
    const { writer } = setup();
    await expect(savePrivatePlayerNote({ ...base, clubId, teamId, eventId, playerId, note: "x".repeat(2001), writer })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(writer.savePrivatePlayerNote).not.toHaveBeenCalled();
  });
});
