---
name: design-implementation
description: Implement approved The Stable high-fidelity design system and responsive screen specs without inventing new visual tokens.
paths:
  - "apps/mobile/**/*.tsx"
  - "apps/web/**/*.{ts,tsx,css}"
  - "packages/design-tokens/**"
---
# Design Implementation
Read DESIGN_HANDOFF, approved DESIGN_SYSTEM, and `design/stable-v1-final.png`.
Use semantic tokens only.
Validate mobile widths 360/393/430 and admin 1024/1280/1440 where relevant.
Preserve accessibility, dynamic text and >=44pt touch targets.
Do not add arbitrary gradients/colors/components absent from the approved system.
