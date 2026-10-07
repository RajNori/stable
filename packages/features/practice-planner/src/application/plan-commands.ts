import { ApplicationError } from "@stable/contracts";
import type {
  GuardianLinkFact,
  MembershipFact,
  PlayerTeamRegistrationFact,
  Principal,
  TeamMembershipFact,
} from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";
import { z } from "zod";

export const PLANNER_FOCUS_CODES = [
  "SHOOTING",
  "BALL_HANDLING",
  "PASSING",
  "REBOUNDING",
  "DEFENCE",
  "COMMUNICATION",
  "TEAMWORK",
  "TRANSITION",
] as const;
export type PlannerFocusCode = (typeof PLANNER_FOCUS_CODES)[number];

const id = z.string().uuid();
const text = (max: number, nonempty = false) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !nonempty || value.length > 0)
    .refine(
      (value) =>
        !Array.from(value).some((c) => {
          const n = c.charCodeAt(0);
          return (n < 0x20 && n !== 0x0a) || n === 0x7f;
        }),
    );
const blockSchema = z
  .strictObject({
    blockId: id.nullable(),
    order: z.number().int().min(1),
    durationMinutes: z.number().int().min(1),
    drillId: id.nullable(),
    title: text(120).nullable(),
    instructions: text(2000),
  })
  .refine(
    (block) =>
      (block.drillId !== null) !==
      (block.title !== null && block.title.length > 0),
  );
const focusSchema = z.strictObject({
  sourceReviewId: id,
  sourceEventId: id,
  code: z.enum(PLANNER_FOCUS_CODES),
});
const saveSchema = z
  .strictObject({
    planId: id.nullable(),
    trainingEventId: id.nullable(),
    title: text(120, true),
    notes: text(2000),
    blocks: z.array(blockSchema).max(50),
    focus: z.array(focusSchema).max(5),
  })
  .refine((data) => {
    const orders = data.blocks.map((item) => item.order);
    const ids = data.blocks.flatMap((item) =>
      item.blockId ? [item.blockId] : [],
    );
    return (
      new Set(orders).size === orders.length &&
      new Set(ids).size === ids.length &&
      (data.trainingEventId !== null ||
        data.blocks.reduce((sum, block) => sum + block.durationMinutes, 0) <=
          240)
    );
  })
  .refine(
    (data) =>
      new Set(data.focus.map((f) => `${f.sourceReviewId}:${f.code}`)).size ===
      data.focus.length,
  );

export type PracticePlanAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};
export type PracticeBlock = z.infer<typeof blockSchema>;
export type PracticeFocusSnapshot = z.infer<typeof focusSchema>;
export type PracticePlanDraft = z.infer<typeof saveSchema>;
export type PracticePlan = PracticePlanDraft & {
  planId: string;
  isTemplate: boolean;
};
export type TrainingOption = {
  eventId: string;
  startsAt: string;
  endsAt: string | null;
  plan: PracticePlan | null;
};
export type FocusOption = PracticeFocusSnapshot & { reviewedAt: string };
export type PracticeDrill = { drillId: string; name: string };
export type PracticePlanWriter = {
  listTrainingOptions(teamId: string): Promise<TrainingOption[]>;
  listTemplates(teamId: string): Promise<PracticePlan[]>;
  listFocusOptions(teamId: string): Promise<FocusOption[]>;
  listDrills(teamId: string): Promise<PracticeDrill[]>;
  save(command: PracticePlanDraft): Promise<string>;
  saveDrill(
    name: string,
    instructions: string,
    defaultDurationMinutes: number | null,
  ): Promise<string>;
  copy(
    sourcePlanId: string,
    trainingEventId: string | null,
    asTemplate: boolean,
  ): Promise<string>;
};

function fail(
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_FAILED",
): never {
  throw new ApplicationError(code, code);
}
function authorize(
  input: PracticePlanAccess,
  clubId: string,
  teamId: string,
): void {
  if (input.principal === null) fail("UNAUTHENTICATED");
  if (
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: { clubId, teamId, teamActive: input.teamActive },
      capability: "practice_plan.manage",
    }) !== "allow"
  )
    fail("FORBIDDEN");
}

export async function readPracticePlanner(
  input: PracticePlanAccess & {
    clubId: string;
    teamId: string;
    writer: PracticePlanWriter;
  },
): Promise<{
  trainings: TrainingOption[];
  templates: PracticePlan[];
  focusOptions: FocusOption[];
  drills: PracticeDrill[];
}> {
  authorize(input, input.clubId, input.teamId);
  return {
    trainings: await input.writer.listTrainingOptions(input.teamId),
    templates: await input.writer.listTemplates(input.teamId),
    focusOptions: await input.writer.listFocusOptions(input.teamId),
    drills: await input.writer.listDrills(input.teamId),
  };
}

export async function savePracticeDrill(
  input: PracticePlanAccess & {
    clubId: string;
    teamId: string;
    name: string;
    instructions: string;
    defaultDurationMinutes: number | null;
    writer: PracticePlanWriter;
  },
): Promise<string> {
  authorize(input, input.clubId, input.teamId);
  const parsed = z
    .strictObject({
      name: text(120, true),
      instructions: text(2000),
      defaultDurationMinutes: z.number().int().min(1).max(240).nullable(),
    })
    .safeParse({
      name: input.name,
      instructions: input.instructions,
      defaultDurationMinutes: input.defaultDurationMinutes,
    });
  if (!parsed.success) fail("VALIDATION_FAILED");
  return input.writer.saveDrill(
    parsed.data.name,
    parsed.data.instructions,
    parsed.data.defaultDurationMinutes,
  );
}

export async function savePracticePlan(
  input: PracticePlanAccess & {
    clubId: string;
    teamId: string;
    draft: PracticePlanDraft;
    writer: PracticePlanWriter;
  },
): Promise<string> {
  authorize(input, input.clubId, input.teamId);
  const parsed = saveSchema.safeParse(input.draft);
  if (!parsed.success) fail("VALIDATION_FAILED");
  return input.writer.save(parsed.data);
}

export async function copyPracticePlan(
  input: PracticePlanAccess & {
    clubId: string;
    teamId: string;
    sourcePlanId: string;
    trainingEventId: string | null;
    asTemplate: boolean;
    writer: PracticePlanWriter;
  },
): Promise<string> {
  authorize(input, input.clubId, input.teamId);
  const parsed = z
    .strictObject({
      sourcePlanId: id,
      trainingEventId: id.nullable(),
      asTemplate: z.boolean(),
    })
    .safeParse({
      sourcePlanId: input.sourcePlanId,
      trainingEventId: input.trainingEventId,
      asTemplate: input.asTemplate,
    });
  if (
    !parsed.success ||
    (!parsed.data.asTemplate && parsed.data.trainingEventId === null)
  )
    fail("VALIDATION_FAILED");
  return input.writer.copy(
    parsed.data.sourcePlanId,
    parsed.data.trainingEventId,
    parsed.data.asTemplate,
  );
}
