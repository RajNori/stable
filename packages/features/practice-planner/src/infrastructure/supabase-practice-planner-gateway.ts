import { ApplicationError } from "@stable/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PLANNER_FOCUS_CODES } from "../application/plan-commands";
import type {
  FocusOption,
  PracticeDrill,
  PracticePlan,
  PracticePlanDraft,
  PracticePlanWriter,
  TrainingOption,
} from "../application/plan-commands";

const focusCode = z.enum(PLANNER_FOCUS_CODES);
const focus = z.object({
  source_review_id: z.string().uuid(),
  source_event_id: z.string().uuid(),
  code: focusCode,
});
const block = z.object({
  block_id: z.string().uuid(),
  order: z.number().int(),
  duration_minutes: z.number().int(),
  drill_id: z.string().uuid().nullable(),
  title: z.string().nullable(),
  instructions: z.string(),
});
const plan = z.object({
  plan_id: z.string().uuid(),
  training_event_id: z.string().uuid().nullable(),
  is_template: z.boolean(),
  title: z.string(),
  notes: z.string(),
  blocks: z.array(block),
  focus: z.array(focus),
});
const payload = z.object({
  trainings: z.array(
    z.object({
      event_id: z.string().uuid(),
      starts_at: z.string(),
      ends_at: z.string().nullable(),
      plan: plan.nullable(),
    }),
  ),
  templates: z.array(plan),
  focus_sources: z.array(
    z.object({
      source_review_id: z.string().uuid(),
      source_event_id: z.string().uuid(),
      code: focusCode,
      reviewed_at: z.string(),
    }),
  ),
  drills: z.array(z.object({ drill_id: z.string().uuid(), name: z.string() })),
});

function parsePlan(value: z.infer<typeof plan>): PracticePlan {
  return {
    planId: value.plan_id,
    trainingEventId: value.training_event_id,
    isTemplate: value.is_template,
    title: value.title,
    notes: value.notes,
    blocks: value.blocks.map((row) => ({
      blockId: row.block_id,
      order: row.order,
      durationMinutes: row.duration_minutes,
      drillId: row.drill_id,
      title: row.title,
      instructions: row.instructions,
    })),
    focus: value.focus.map((row) => ({
      sourceReviewId: row.source_review_id,
      sourceEventId: row.source_event_id,
      code: row.code,
    })),
  };
}

export function createSupabasePracticePlannerGateway(
  client: SupabaseClient,
  commandTeamId: string,
): PracticePlanWriter {
  let readPromise: ReturnType<SupabaseClient["rpc"]> | null = null;
  const read = async () => {
    readPromise ??= client.rpc("read_practice_planner", {
      p_team_id: commandTeamId,
    });
    const { data, error } = await readPromise;
    if (error !== null) throw new ApplicationError("INTERNAL", error.message);
    const parsed = payload.safeParse(data);
    if (!parsed.success)
      throw new ApplicationError(
        "INTERNAL",
        "Practice planner response was invalid.",
      );
    return parsed.data;
  };
  return {
    async listTrainingOptions(teamId): Promise<TrainingOption[]> {
      if (teamId !== commandTeamId)
        throw new ApplicationError("FORBIDDEN", "Team scope mismatch.");
      const result = await read();
      return result.trainings.map((row) => ({
        eventId: row.event_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        plan: row.plan === null ? null : parsePlan(row.plan),
      }));
    },
    async listTemplates(teamId): Promise<PracticePlan[]> {
      if (teamId !== commandTeamId)
        throw new ApplicationError("FORBIDDEN", "Team scope mismatch.");
      return (await read()).templates.map(parsePlan);
    },
    async listFocusOptions(teamId): Promise<FocusOption[]> {
      if (teamId !== commandTeamId)
        throw new ApplicationError("FORBIDDEN", "Team scope mismatch.");
      return (await read()).focus_sources.map((row) => ({
        sourceReviewId: row.source_review_id,
        sourceEventId: row.source_event_id,
        code: row.code,
        reviewedAt: row.reviewed_at,
      }));
    },
    async listDrills(teamId): Promise<PracticeDrill[]> {
      if (teamId !== commandTeamId)
        throw new ApplicationError("FORBIDDEN", "Team scope mismatch.");
      return (await read()).drills.map((row) => ({
        drillId: row.drill_id,
        name: row.name,
      }));
    },
    async save(command: PracticePlanDraft): Promise<string> {
      const { data, error } = await client.rpc("save_practice_plan", {
        p_team_id: commandTeamId,
        p_plan_id: command.planId,
        p_training_event_id: command.trainingEventId,
        p_title: command.title,
        p_notes: command.notes,
        p_blocks: command.blocks.map((row) => ({
          block_id: row.blockId,
          order: row.order,
          duration_minutes: row.durationMinutes,
          drill_id: row.drillId,
          title: row.title,
          instructions: row.instructions,
        })),
        p_focus: command.focus.map((row) => ({
          source_review_id: row.sourceReviewId,
          source_event_id: row.sourceEventId,
          code: row.code,
        })),
      });
      if (error !== null) throw new ApplicationError("INTERNAL", error.message);
      const parsed = z.string().uuid().safeParse(data);
      if (!parsed.success)
        throw new ApplicationError(
          "INTERNAL",
          "Practice plan save response was invalid.",
        );
      return parsed.data;
    },
    async saveDrill(
      name,
      instructions,
      defaultDurationMinutes,
    ): Promise<string> {
      const { data, error } = await client.rpc("save_practice_drill", {
        p_team_id: commandTeamId,
        p_name: name,
        p_instructions: instructions,
        p_default_duration_minutes: defaultDurationMinutes,
      });
      if (error !== null) throw new ApplicationError("INTERNAL", error.message);
      const parsed = z.string().uuid().safeParse(data);
      if (!parsed.success)
        throw new ApplicationError(
          "INTERNAL",
          "Practice drill save response was invalid.",
        );
      return parsed.data;
    },
    async copy(sourcePlanId, trainingEventId, asTemplate): Promise<string> {
      const { data, error } = await client.rpc("copy_practice_plan", {
        p_team_id: commandTeamId,
        p_source_plan_id: sourcePlanId,
        p_training_event_id: trainingEventId,
        p_as_template: asTemplate,
      });
      if (error !== null) throw new ApplicationError("INTERNAL", error.message);
      const parsed = z.string().uuid().safeParse(data);
      if (!parsed.success)
        throw new ApplicationError(
          "INTERNAL",
          "Practice plan copy response was invalid.",
        );
      return parsed.data;
    },
  };
}
