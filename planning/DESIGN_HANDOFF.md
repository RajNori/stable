# Design Handoff Contract

**Status:** APPROVED — V1 visual direction is frozen for implementation.  
**Visual reference:** `design/stable-v1-final.png`  
**Implementation authority:** `planning/DESIGN_SYSTEM.md`

## Gate

Production UI implementation may proceed using the approved design contract.

The design board is a visual reference, not a Figma inspectable source. Do not derive fragile pixel measurements from the PNG where the design-system contract already provides a rule.

## Implementation order

Freeze/implement visual primitives around:
1. Parent Home
2. Game Day
3. Schedule
4. Training
5. Coach/staff workflow
6. Club Admin

Then extend the same system to remaining screens.

## Required validation

Mobile:
- 360 px
- 393 px
- 430 px

Admin:
- 1024 px
- 1280 px
- 1440 px

## Theming

Use semantic design tokens.

Mentone Mustangs maps its green/gold identity into the semantic theme.

Do not embed Mentone-specific colors or names into reusable component logic.

## Accessibility

Accessibility overrides literal screenshot imitation when required.

Minimum:
- 44x44 touch targets;
- no color-only states;
- Dynamic Type/text scaling tolerance;
- accessible focus and labels;
- reduced motion support.

## Change policy

Do not reopen broad design exploration during implementation.

A design change requires one of:
- proven accessibility issue;
- responsive failure;
- product requirement conflict;
- implementation impossibility;
- usability problem found in pilot testing.

Minor implementation adjustments remain within the design system and should not trigger a redesign cycle.
