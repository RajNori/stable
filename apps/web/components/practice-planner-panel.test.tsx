import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PracticePlannerPanel } from "./practice-planner-panel";

const props = {
  clubId: "10000000-0000-4000-8000-000000000001",
  teamId: "20000000-0000-4000-8000-000000000001",
  trainings: [
    {
      eventId: "30000000-0000-4000-8000-000000000001",
      startsAt: "2026-10-09T08:00:00Z",
      endsAt: null,
      plan: null,
    },
  ],
  templates: [
    {
      planId: "50000000-0000-4000-8000-000000000001",
      trainingEventId: null,
      isTemplate: true,
      title: "Passing",
      notes: "",
      blocks: [],
      focus: [],
    },
  ],
  focusOptions: [
    {
      sourceReviewId: "40000000-0000-4000-8000-000000000001",
      sourceEventId: "70000000-0000-4000-8000-000000000001",
      code: "PASSING" as const,
      reviewedAt: "2026-10-08T00:00:00Z",
    },
  ],
  drills: [
    {
      drillId: "80000000-0000-4000-8000-000000000001",
      name: "Passing triangles",
    },
  ],
  save: vi.fn(),
  copy: vi.fn(),
  createDrill: vi.fn(),
  canManage: true,
};

afterEach(cleanup);

describe("practice planner panel", () => {
  it("offers linked plans, typed focus, template application and previous-plan duplication", () => {
    render(<PracticePlannerPanel {...props} />);
    expect(
      screen.getByRole("region", { name: "Practice planner" }),
    ).toBeTruthy();
    expect(screen.getAllByLabelText("Plan title").length).toBe(2);
    expect(screen.getAllByLabelText(/PASSING/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Apply template" })).toBeTruthy();
    expect(
      screen.getAllByRole("option", { name: "Passing triangles" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Create reusable template" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add drill" })).toBeTruthy();
  });

  it("hides planner details for callers without coaching/admin capability", () => {
    const { container } = render(
      <PracticePlannerPanel {...props} canManage={false} />,
    );
    expect(container.textContent).toBe("");
  });

  it("selects an existing focus and carries the nearest earlier plan forward", () => {
    const focus = props.focusOptions[0];
    const template = props.templates[0];
    const training = props.trainings[0];
    if (
      focus === undefined ||
      template === undefined ||
      training === undefined
    ) {
      throw new Error("Expected planning fixture data");
    }
    const earlierPlan = {
      ...template,
      planId: "50000000-0000-4000-8000-000000000002",
      trainingEventId: "30000000-0000-4000-8000-000000000001",
      isTemplate: false,
      title: "Last practice",
      focus: [focus],
      blocks: [
        {
          blockId: "60000000-0000-4000-8000-000000000001",
          order: 1,
          durationMinutes: 15,
          drillId: null,
          title: "Warm up",
          instructions: "Move safely.",
        },
      ],
    };
    render(
      <PracticePlannerPanel
        {...props}
        trainings={[
          { ...training, plan: earlierPlan },
          {
            ...training,
            eventId: "30000000-0000-4000-8000-000000000002",
            startsAt: "2026-10-16T08:00:00Z",
            endsAt: "2026-10-16T09:00:00Z",
          },
        ]}
        templates={[]}
      />,
    );

    const focusCheckbox = screen.getAllByRole("checkbox", {
      name: /PASSING/,
    })[0];
    if (focusCheckbox === undefined)
      throw new Error("Expected review focus checkbox");
    expect((focusCheckbox as HTMLInputElement).checked).toBe(true);
    expect(screen.getByDisplayValue("Warm up")).toBeTruthy();
    expect(screen.getByText(/scheduled 60 minutes/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply template" })).toBeNull();
  });
});
