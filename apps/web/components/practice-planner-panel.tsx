import type {
  FocusOption,
  PracticeDrill,
  PracticePlan,
  TrainingOption,
} from "@stable/practice-planner";

type Action = (formData: FormData) => Promise<void>;

function PlanFields({
  plan,
  focusOptions,
  drills,
  trainingEventId,
  clubId,
  teamId,
  save,
}: {
  plan: PracticePlan | null;
  focusOptions: FocusOption[];
  drills: PracticeDrill[];
  trainingEventId: string | null;
  clubId: string;
  teamId: string;
  save: Action;
}) {
  const blocks = plan?.blocks ?? [];
  const rows = [
    ...blocks,
    {
      blockId: null,
      order: blocks.length + 1,
      durationMinutes: 10,
      drillId: null,
      title: "",
      instructions: "",
    },
  ];
  const selected = new Set(
    (plan?.focus ?? []).map(
      (item) => `${item.sourceReviewId}|${item.sourceEventId}|${item.code}`,
    ),
  );
  return (
    <form action={save}>
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="teamId" value={teamId} />
      <input
        type="hidden"
        name="trainingEventId"
        value={trainingEventId ?? ""}
      />
      <input type="hidden" name="planId" value={plan?.planId ?? ""} />
      <label>
        Plan title
        <input
          name="title"
          maxLength={120}
          required
          defaultValue={plan?.title ?? ""}
        />
      </label>
      <label>
        Notes
        <textarea
          name="notes"
          maxLength={2000}
          defaultValue={plan?.notes ?? ""}
        />
      </label>
      <fieldset>
        <legend>Practice blocks</legend>
        {rows.map((block, index) => (
          <fieldset key={block.blockId ?? `new-${index}`}>
            <legend>
              {block.blockId === null
                ? "Add block"
                : `Block ${String(index + 1)}`}
            </legend>
            <input type="hidden" name="blockId" value={block.blockId ?? ""} />
            <label>
              Order
              <input
                name="order"
                type="number"
                min={1}
                max={50}
                required
                defaultValue={block.order}
              />
            </label>
            <label>
              Minutes
              <input
                name="durationMinutes"
                type="number"
                min={1}
                required
                defaultValue={block.durationMinutes}
              />
            </label>
            <label>
              Drill
              <select name="drillId" defaultValue={block.drillId ?? ""}>
                <option value="">Use a title</option>
                {drills.map((drill) => (
                  <option key={drill.drillId} value={drill.drillId}>
                    {drill.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Or block title
              <input
                name="blockTitle"
                type="text"
                maxLength={120}
                defaultValue={block.title ?? ""}
              />
            </label>
            <label>
              Instructions
              <textarea
                name="instructions"
                maxLength={2000}
                defaultValue={block.instructions}
              />
            </label>
          </fieldset>
        ))}
      </fieldset>
      <fieldset>
        <legend>Explicit focus from a team review (choose up to five)</legend>
        {focusOptions.length === 0 ? (
          <p>No review focus is available to select.</p>
        ) : (
          focusOptions.map((focus) => {
            const value = `${focus.sourceReviewId}|${focus.sourceEventId}|${focus.code}`;
            return (
              <label key={value}>
                <input
                  type="checkbox"
                  name="focusRef"
                  value={value}
                  defaultChecked={selected.has(value)}
                />
                {focus.code} · {focus.reviewedAt}
              </label>
            );
          })
        )}
      </fieldset>
      <button type="submit">Save practice plan</button>
    </form>
  );
}

export function PracticePlannerPanel({
  clubId,
  teamId,
  trainings,
  templates,
  focusOptions,
  drills,
  canManage,
  save,
  copy,
  createDrill,
  error,
}: {
  clubId: string;
  teamId: string;
  trainings: TrainingOption[];
  templates: PracticePlan[];
  focusOptions: FocusOption[];
  drills: PracticeDrill[];
  canManage: boolean;
  save: Action;
  copy: Action;
  createDrill: Action;
  error?: string | undefined;
}) {
  if (!canManage) return null;
  return (
    <section aria-label="Practice planner">
      <h2>Practice planner</h2>
      {error ? <p role="alert">{error}</p> : null}
      {trainings.map((training, index) => {
        const previous = [...trainings.slice(0, index)]
          .reverse()
          .find((option) => option.plan !== null)?.plan;
        const duration =
          training.endsAt === null
            ? "up to 240 minutes"
            : `scheduled ${Math.floor((Date.parse(training.endsAt) - Date.parse(training.startsAt)) / 60000)} minutes`;
        return (
          <article key={training.eventId}>
            <h3>
              Training · {training.startsAt} · {duration}
            </h3>
            <PlanFields
              plan={training.plan}
              focusOptions={focusOptions}
              drills={drills}
              trainingEventId={training.eventId}
              clubId={clubId}
              teamId={teamId}
              save={save}
            />
            {training.plan === null && templates.length > 0 ? (
              <form action={copy}>
                <input type="hidden" name="clubId" value={clubId} />
                <input type="hidden" name="teamId" value={teamId} />
                <input
                  type="hidden"
                  name="trainingEventId"
                  value={training.eventId}
                />
                <label>
                  Apply reusable template
                  <select name="sourcePlanId" required defaultValue="">
                    <option value="" disabled>
                      Select template
                    </option>
                    {templates.map((template) => (
                      <option key={template.planId} value={template.planId}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Apply template</button>
              </form>
            ) : null}
            {training.plan === null && previous ? (
              <form action={copy}>
                <input type="hidden" name="clubId" value={clubId} />
                <input type="hidden" name="teamId" value={teamId} />
                <input
                  type="hidden"
                  name="trainingEventId"
                  value={training.eventId}
                />
                <input
                  type="hidden"
                  name="sourcePlanId"
                  value={previous.planId}
                />
                <button type="submit">Duplicate previous plan</button>
              </form>
            ) : null}
          </article>
        );
      })}
      <h3>Reusable templates</h3>
      {templates.map((template) => (
        <article key={template.planId}>
          <h4>{template.title}</h4>
          <p>{template.blocks.length} blocks</p>
          <form action={copy}>
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="sourcePlanId" value={template.planId} />
            <input type="hidden" name="asTemplate" value="true" />
            <button type="submit">Duplicate template</button>
          </form>
        </article>
      ))}
      <h3>Create reusable template</h3>
      <PlanFields
        plan={null}
        focusOptions={focusOptions}
        drills={drills}
        trainingEventId={null}
        clubId={clubId}
        teamId={teamId}
        save={save}
      />
      <h3>Team drill library</h3>
      {drills.map((drill) => (
        <p key={drill.drillId}>{drill.name}</p>
      ))}
      <form action={createDrill}>
        <input type="hidden" name="clubId" value={clubId} />
        <input type="hidden" name="teamId" value={teamId} />
        <label>
          Drill name
          <input name="drillName" maxLength={120} required />
        </label>
        <label>
          Drill instructions
          <textarea name="drillInstructions" maxLength={2000} />
        </label>
        <label>
          Default minutes
          <input name="drillMinutes" type="number" min={1} max={240} />
        </label>
        <button type="submit">Add drill</button>
      </form>
    </section>
  );
}
