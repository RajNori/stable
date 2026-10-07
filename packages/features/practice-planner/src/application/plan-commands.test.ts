import { describe, expect, it, vi } from "vitest";

import {
  copyPracticePlan,
  readPracticePlanner,
  savePracticeDrill,
  savePracticePlan,
} from "./plan-commands";
import type {
  PracticePlanAccess,
  PracticePlanDraft,
  PracticePlanWriter,
} from "./plan-commands";

const clubId = "10000000-0000-4000-8000-000000000001";
const teamId = "20000000-0000-4000-8000-000000000001";
const eventId = "30000000-0000-4000-8000-000000000001";
const reviewId = "40000000-0000-4000-8000-000000000001";
const sourceId = "50000000-0000-4000-8000-000000000001";
const actorId = "60000000-0000-4000-8000-000000000001";

function access(
  role: "coach" | "admin" | "manager" | "guardian" | "revoked" = "coach",
): PracticePlanAccess {
  return {
    principal: role === "guardian" ? { userId: actorId } : { userId: actorId },
    clubMemberships:
      role === "admin" ? [{ clubId, role: "CLUB_ADMIN", active: true }] : [],
    teamMemberships:
      role === "coach" || role === "revoked"
        ? [
            {
              clubId,
              teamId,
              role: "ASSISTANT_COACH",
              active: role === "coach",
              teamActive: true,
            },
          ]
        : role === "manager"
          ? [
              {
                clubId,
                teamId,
                role: "TEAM_MANAGER",
                active: true,
                teamActive: true,
              },
            ]
          : [],
    guardianLinks:
      role === "guardian"
        ? [{ clubId, playerId: sourceId, active: true, playerActive: true }]
        : [],
    registrations:
      role === "guardian"
        ? [
            {
              clubId,
              teamId,
              playerId: sourceId,
              active: true,
              teamActive: true,
            },
          ]
        : [],
    teamActive: true,
  };
}
function writer(): PracticePlanWriter {
  return {
    listTrainingOptions: vi.fn().mockResolvedValue([]),
    listTemplates: vi.fn().mockResolvedValue([]),
    listFocusOptions: vi.fn().mockResolvedValue([]),
    listDrills: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(sourceId),
    saveDrill: vi.fn().mockResolvedValue(sourceId),
    copy: vi.fn().mockResolvedValue(sourceId),
  };
}
const draft: PracticePlanDraft = {
  planId: null,
  trainingEventId: eventId,
  title: "Passing and spacing",
  notes: "Keep groups moving",
  blocks: [
    {
      blockId: null,
      order: 1,
      durationMinutes: 20,
      drillId: null,
      title: "Three player passing",
      instructions: "Move after passing",
    },
  ],
  focus: [
    {
      sourceReviewId: reviewId,
      sourceEventId: eventId,
      code: "PASSING" as const,
    },
  ],
};
function first<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("Expected a test fixture value.");
  return value;
}
const firstBlock = first(draft.blocks);
const firstFocus = first(draft.focus);

describe("practice planner commands", () => {
  it.each(["coach", "admin"] as const)("allows %s", async (role) => {
    const gateway = writer();
    await expect(
      savePracticePlan({
        ...access(role),
        clubId,
        teamId,
        draft,
        writer: gateway,
      }),
    ).resolves.toBe(sourceId);
    await expect(
      readPracticePlanner({ ...access(role), clubId, teamId, writer: gateway }),
    ).resolves.toEqual({
      trainings: [],
      templates: [],
      focusOptions: [],
      drills: [],
    });
  });
  it.each(["manager", "guardian", "revoked"] as const)(
    "denies %s",
    async (role) => {
      await expect(
        savePracticePlan({
          ...access(role),
          clubId,
          teamId,
          draft,
          writer: writer(),
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    },
  );
  it("denies revoked or inactive team context when reading", async () => {
    await expect(
      readPracticePlanner({
        ...access("revoked"),
        clubId,
        teamId,
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      readPracticePlanner({
        ...access(),
        clubId,
        teamId,
        teamActive: false,
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("validates stable order, duration, typed focus references and text bounds before writing", async () => {
    const gateway = writer();
    await expect(
      savePracticePlan({
        ...access(),
        clubId,
        teamId,
        draft: { ...draft, blocks: [{ ...firstBlock, order: 0 }] },
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      savePracticePlan({
        ...access(),
        clubId,
        teamId,
        draft: { ...draft, blocks: [{ ...firstBlock, durationMinutes: 0 }] },
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      savePracticePlan({
        ...access(),
        clubId,
        teamId,
        draft: { ...draft, title: "x".repeat(121) },
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      savePracticePlan({
        ...access(),
        clubId,
        teamId,
        draft: {
          ...draft,
          focus: [{ ...firstFocus, code: "PRIVATE_NOTE" as never }],
        },
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(gateway.save).not.toHaveBeenCalled();
  });
  it("rejects duplicate identities, duplicate focus, invalid blocks and unsafe text", async () => {
    const gateway = writer();
    const stableId = "90000000-0000-4000-8000-000000000001";
    const pair = [
      { ...firstBlock, blockId: stableId, order: 1 },
      { ...firstBlock, blockId: stableId, order: 2 },
    ];
    const invalidDrafts: PracticePlanDraft[] = [
      { ...draft, blocks: [firstBlock, { ...firstBlock, order: 1 }] },
      { ...draft, blocks: pair },
      {
        ...draft,
        blocks: [{ ...firstBlock, drillId: sourceId }],
      },
      {
        ...draft,
        blocks: [{ ...firstBlock, title: null }],
      },
      { ...draft, title: "   " },
      { ...draft, notes: "x".repeat(2001) },
      {
        ...draft,
        blocks: [{ ...firstBlock, instructions: `unsafe\u0001text` }],
      },
      { ...draft, focus: [firstFocus, { ...firstFocus }] },
    ];
    for (const invalidDraft of invalidDrafts) {
      await expect(
        savePracticePlan({
          ...access(),
          clubId,
          teamId,
          draft: invalidDraft,
          writer: gateway,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    }
    expect(gateway.save).not.toHaveBeenCalled();
  });
  it("requires an authenticated principal and allows a 240-minute template", async () => {
    const gateway = writer();
    await expect(
      readPracticePlanner({
        ...access(),
        principal: null,
        clubId,
        teamId,
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const template: PracticePlanDraft = {
      ...draft,
      trainingEventId: null,
      blocks: [{ ...firstBlock, durationMinutes: 240 }],
    };
    await expect(
      savePracticePlan({
        ...access(),
        clubId,
        teamId,
        draft: template,
        writer: gateway,
      }),
    ).resolves.toBe(sourceId);
  });
  it("caps reusable templates at 240 total minutes", async () => {
    const gateway = writer();
    const template = {
      ...draft,
      trainingEventId: null,
      blocks: [
        { ...firstBlock, order: 1, durationMinutes: 240 },
        { ...firstBlock, blockId: null, order: 2, durationMinutes: 1 },
      ],
    };
    await expect(
      savePracticePlan({
        ...access(),
        clubId,
        teamId,
        draft: template,
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(gateway.save).not.toHaveBeenCalled();
  });
  it("leaves linked event totals to authoritative scheduled-duration validation", async () => {
    const gateway = writer();
    const linked = {
      ...draft,
      blocks: [
        { ...firstBlock, order: 1, durationMinutes: 240 },
        { ...firstBlock, blockId: null, order: 2, durationMinutes: 1 },
      ],
    };
    await expect(
      savePracticePlan({
        ...access(),
        clubId,
        teamId,
        draft: linked,
        writer: gateway,
      }),
    ).resolves.toBe(sourceId);
    expect(gateway.save).toHaveBeenCalledOnce();

    await expect(
      savePracticePlan({
        ...access(),
        clubId,
        teamId,
        draft: {
          ...draft,
          blocks: [{ ...firstBlock, durationMinutes: 241 }],
        },
        writer: gateway,
      }),
    ).resolves.toBe(sourceId);
    expect(gateway.save).toHaveBeenCalledTimes(2);
  });
  it("copies from a source snapshot to an event or template", async () => {
    const gateway = writer();
    await copyPracticePlan({
      ...access(),
      clubId,
      teamId,
      sourcePlanId: sourceId,
      trainingEventId: eventId,
      asTemplate: false,
      writer: gateway,
    });
    expect(gateway.copy).toHaveBeenCalledWith(sourceId, eventId, false);
    await expect(
      copyPracticePlan({
        ...access(),
        clubId,
        teamId,
        sourcePlanId: sourceId,
        trainingEventId: null,
        asTemplate: false,
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
  it("authorizes and validates team drill creation", async () => {
    const gateway = writer();
    await expect(
      savePracticeDrill({
        ...access(),
        clubId,
        teamId,
        name: "Shell drill",
        instructions: "Close out",
        defaultDurationMinutes: 12,
        writer: gateway,
      }),
    ).resolves.toBe(sourceId);
    await expect(
      savePracticeDrill({
        ...access("manager"),
        clubId,
        teamId,
        name: "Shell drill",
        instructions: "",
        defaultDurationMinutes: 12,
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      savePracticeDrill({
        ...access(),
        clubId,
        teamId,
        name: "x".repeat(121),
        instructions: "",
        defaultDurationMinutes: 12,
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
  it("validates drill duration and supports a nullable suggested duration", async () => {
    const gateway = writer();
    await expect(
      savePracticeDrill({
        ...access(),
        clubId,
        teamId,
        name: "  Shell drill  ",
        instructions: "  Close out  ",
        defaultDurationMinutes: null,
        writer: gateway,
      }),
    ).resolves.toBe(sourceId);
    expect(gateway.saveDrill).toHaveBeenCalledWith(
      "Shell drill",
      "Close out",
      null,
    );
    for (const defaultDurationMinutes of [0, 1.5, 241]) {
      await expect(
        savePracticeDrill({
          ...access(),
          clubId,
          teamId,
          name: "Shell drill",
          instructions: "Close out",
          defaultDurationMinutes,
          writer: gateway,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    }
  });
  it("validates copy IDs and permits explicit template copies", async () => {
    const gateway = writer();
    await expect(
      copyPracticePlan({
        ...access(),
        clubId,
        teamId,
        sourcePlanId: sourceId,
        trainingEventId: null,
        asTemplate: true,
        writer: gateway,
      }),
    ).resolves.toBe(sourceId);
    expect(gateway.copy).toHaveBeenCalledWith(sourceId, null, true);
    await expect(
      copyPracticePlan({
        ...access(),
        clubId,
        teamId,
        sourcePlanId: "not-a-uuid",
        trainingEventId: eventId,
        asTemplate: false,
        writer: gateway,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
