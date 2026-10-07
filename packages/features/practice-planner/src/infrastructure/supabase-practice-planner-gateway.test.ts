import { describe, expect, it, vi } from "vitest";

import { createSupabasePracticePlannerGateway } from "./supabase-practice-planner-gateway";

const teamId = "20000000-0000-4000-8000-000000000001";
const planId = "50000000-0000-4000-8000-000000000001";
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
    await expect(broken.gateway.copy(planId, null, true)).rejects.toMatchObject(
      { code: "INTERNAL" },
    );
  });
  it("prevents gateway use with a mismatched team scope", async () => {
    const { rpc, gateway } = client({
      trainings: [],
      templates: [],
      focus_sources: [],
      drills: [],
    });
    await expect(
      gateway.listTemplates("80000000-0000-4000-8000-000000000001"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
