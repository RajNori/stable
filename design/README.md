# The Stable — Approved V1 Design Reference

## Authority

`stable-v1-final.png` is the approved visual reference for the V1 product.

It is not a Figma-style inspectable handoff and must not be treated as a source for pixel-perfect extraction of every measurement. Engineering must use:

1. `planning/DESIGN_SYSTEM.md` for implementation rules and tokens.
2. `design/stable-v1-final.png` for visual composition, hierarchy, density, tone and screen intent.
3. Approved product/architecture documents for behaviour and permissions.

If the PNG and `DESIGN_SYSTEM.md` appear to conflict, follow `DESIGN_SYSTEM.md` and raise the discrepancy to the Integrator.

## Implementation rule

Agents may reproduce the approved design, but must not reinterpret the product into another design language.

Do not:
- introduce a different palette;
- invent gradients/glassmorphism;
- replace the navigation model;
- restyle the product as a generic SaaS dashboard;
- reduce accessibility for visual similarity;
- create new component variants without an actual product need.

## Priority screens

The visual language is anchored by:
1. Parent Home
2. Game Day
3. Schedule
4. Training
5. Coach/staff workflow
6. Club Admin

Game Day is the highest-energy screen. Other screens should remain quieter.

## Responsive validation

Mobile:
- 360 px width
- 393 px width
- 430 px width

Admin:
- 1024 px
- 1280 px
- 1440 px

Do not crop or derive low-resolution per-screen assets from the board and treat them as independent design truth.
