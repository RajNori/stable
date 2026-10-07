import { describe, expect, it, vi } from "vitest";

import { createSupabasePracticePlannerGateway } from "./supabase-practice-planner-gateway";

const teamId = "20000000-0000-4000-8000-000000000001";
const planId = "50000000-0000-4000-8000-000000000001";
const plannerPlan = {
  plan_id: planId,
  training_event_id: null,
  is_template: true,
  title: "Passing",
  notes: "Keep the group moving",
  blocks: [
    {
      block_id: "90000000-0000-4000-8000-000000000001",
      order: 1,
      duration_minutes: 241,
      drill_id: null,
      title: "Three player passing",
      instructions: "Move after passing",
    },
  ],
  focus: [
    {
      source_review_id: "40000000-0000-4000-8000-000000000001",
      source_event_id: "70000000-0000-4000-8000-000000000001",
      code: "PASSING",
    },
  ],
};
const client = (
  data: unknown = planId,
  error: { message: string } | null = null,
) => {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return {
    rpc,
    gateway: createSupabasePracticePlannerGateway({ rpc } as never, teamId),
  };
};

describe("Supabase practice planner gateway", () => {
  it("maps one atomic plan save including stable block ids and typed focus references", async () => {
    const { rpc, gateway } = client();
    await expect(
      gateway.save({
        planId: null,
        trainingEventId: "30000000-0000-4000-8000-000000000001",
        title: "Passing",
        notes: "",
        blocks: [
          {
            blockId: null,
            order: 1,
            durationMinutes: 20,
            drillId: null,
            title: "Three player passing",
            instructions: "",
          },
        ],
        focus: [
          {
            sourceReviewId: "40000000-0000-4000-8000-000000000001",
            sourceEventId: "70000000-0000-4000-8000-000000000001",
            code: "PASSING",
          },
        ],
      }),
    ).resolves.toBe(planId);
    expect(rpc).toHaveBeenCalledWith(
      "save_practice_plan",
      expect.objectContaining({
        p_team_id: teamId,
        p_blocks: [
          {
            block_id: null,
            order: 1,
            duration_minutes: 20,
            drill_id: null,
            title: "Three player passing",
            instructions: "",
          },
        ],
        p_focus: [
          {
            source_review_id: "40000000-0000-4000-8000-000000000001",
            source_event_id: "70000000-0000-4000-8000-000000000001",
            code: "PASSING",
          },
        ],
      }),
    );
  });
  it("maps reads and rejects malformed responses and RPC failures", async () => {
    const { gateway } = client({
      trainings: [],
      templates: [],
      focus_sources: [],
      drills: [],
    });
    await expect(gateway.listTrainingOptions(teamId)).resolves.toEqual([]);
    const malformed = client({ trainings: [] });
    await expect(
      malformed.gateway.listTrainingOptions(teamId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    const broken = client(null, { message: "database unavailable" });
    await expect(
      broken.gateway.listTrainingOptions(teamId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(broken.gateway.copy(planId, null, true)).rejects.toMatchObject(
      { code: "INTERNAL" },
    );
  });
  it("maps each read collection and nested plan fields while reusing one RPC", async () => {
    const { rpc, gateway } = client({
      trainings: [
        {
          event_id: "30000000-0000-4000-8000-000000000001",
          starts_at: "2026-10-01T09:00:00Z",
          ends_at: null,
          plan: {
            ...plannerPlan,
            training_event_id: "30000000-0000-4000-8000-000000000001",
            is_template: false,
          },
        },
        {
          event_id: "30000000-0000-4000-8000-000000000002",
          starts_at: "2026-10-02T09:00:00Z",
          ends_at: "2026-10-02T10:00:00Z",
          plan: null,
        },
      ],
      templates: [plannerPlan],
      focus_sources: [
        {
          source_review_id: "40000000-0000-4000-8000-000000000001",
          source_event_id: "70000000-0000-4000-8000-000000000001",
          code: "PASSING",
          reviewed_at: "2026-09-30T12:00:00Z",
        },
      ],
      drills: [
        {
          drill_id: "80000000-0000-4000-8000-000000000001",
          name: "Shell drill",
        },
      ],
    });
    await expect(gateway.listTrainingOptions(teamId)).resolves.toEqual([
      {
        eventId: "30000000-0000-4000-8000-000000000001",
        startsAt: "2026-10-01T09:00:00Z",
        endsAt: null,
        plan: {
          planId,
          trainingEventId: "30000000-0000-4000-8000-000000000001",
          isTemplate: false,
          title: "Passing",
          notes: "Keep the group moving",
          blocks: [
            {
              blockId: "90000000-0000-4000-8000-000000000001",
              order: 1,
              durationMinutes: 241,
              drillId: null,
              title: "Three player passing",
              instructions: "Move after passing",
            },
          ],
          focus: [
            {
              sourceReviewId: "40000000-0000-4000-8000-000000000001",
              sourceEventId: "70000000-0000-4000-8000-000000000001",
              code: "PASSING",
            },
          ],
        },
      },
      {
        eventId: "30000000-0000-4000-8000-000000000002",
        startsAt: "2026-10-02T09:00:00Z",
        endsAt: "2026-10-02T10:00:00Z",
        plan: null,
      },
    ]);
    await expect(gateway.listTemplates(teamId)).resolves.toMatchObject([
      {
        planId,
        isTemplate: true,
        blocks: [{ durationMinutes: 241 }],
        focus: [{ code: "PASSING" }],
      },
    ]);
    await expect(gateway.listFocusOptions(teamId)).resolves.toEqual([
      {
        sourceReviewId: "40000000-0000-4000-8000-000000000001",
        sourceEventId: "70000000-0000-4000-8000-000000000001",
        code: "PASSING",
        reviewedAt: "2026-09-30T12:00:00Z",
      },
    ]);
    await expect(gateway.listDrills(teamId)).resolves.toEqual([
      {
        drillId: "80000000-0000-4000-8000-000000000001",
        name: "Shell drill",
      },
    ]);
    expect(rpc).toHaveBeenCalledOnce();
  });
  it("prevents gateway use with a mismatched team scope", async () => {
    const { rpc, gateway } = client({
      trainings: [],
      templates: [],
      focus_sources: [],
      drills: [],
    });
    const mismatch = "80000000-0000-4000-8000-000000000001";
    await expect(gateway.listTrainingOptions(mismatch)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(gateway.listTemplates(mismatch)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(gateway.listFocusOptions(mismatch)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(gateway.listDrills(mismatch)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("maps drill and copy writes, RPC errors, and malformed UUID responses", async () => {
    const drill = client();
    await expect(
      drill.gateway.saveDrill("Shell drill", "Close out", 12),
    ).resolves.toBe(planId);
    expect(drill.rpc).toHaveBeenCalledWith("save_practice_drill", {
      p_team_id: teamId,
      p_name: "Shell drill",
      p_instructions: "Close out",
      p_default_duration_minutes: 12,
    });

    const copy = client();
    await expect(copy.gateway.copy(planId, null, true)).resolves.toBe(planId);
    expect(copy.rpc).toHaveBeenCalledWith("copy_practice_plan", {
      p_team_id: teamId,
      p_source_plan_id: planId,
      p_training_event_id: null,
      p_as_template: true,
    });

    for (const operation of [
      (gateway: ReturnType<typeof client>["gateway"]) =>
        gateway.saveDrill("A", "", null),
      (gateway: ReturnType<typeof client>["gateway"]) =>
        gateway.copy(planId, null, true),
    ]) {
      await expect(
        operation(client("not-a-uuid").gateway),
      ).rejects.toMatchObject({ code: "INTERNAL" });
      await expect(
        operation(client(null, { message: "database unavailable" }).gateway),
      ).rejects.toMatchObject({ code: "INTERNAL" });
    }
  });
  it("rejects save RPC failures and malformed save response IDs", async () => {
    const command = {
      planId: null,
      trainingEventId: null,
      title: "Reusable plan",
      notes: "",
      blocks: [],
      focus: [],
    };
    await expect(
      client(null, { message: "database unavailable" }).gateway.save(command),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      client("not-a-uuid").gateway.save(command),
    ).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});
