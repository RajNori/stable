# ADR 0013 — Approved V1 Design System
Status: Accepted

## Context
The final high-fidelity design was produced as a consolidated visual board rather than an inspectable Figma-style handoff. Engineering still requires an authoritative, machine-readable implementation contract.

## Decision
Freeze the current visual direction as the V1 design baseline.

Use:
- `design/stable-v1-final.png` as visual reference;
- `planning/DESIGN_SYSTEM.md` as implementation authority;
- semantic design tokens as the reusable theming layer.

No broad visual redesign is permitted during implementation unless an accessibility, responsive, product-conflict or verified usability issue requires it.

## Consequences
- Agents no longer invent provisional styling.
- Mustangs branding remains strongly represented while preserving future club theming.
- Accessibility may override literal screenshot imitation.
- Design changes during MVP become controlled exceptions rather than ongoing exploration.
