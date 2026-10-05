---
name: offline-game-day-review
description: Review Game Day caching for minimum data, staleness UX, logout isolation and safe reconnect behaviour.
paths:
  - "apps/mobile/**"
  - "packages/features/game-day/**"
---
# Offline Game Day Review
Verify:
- minimum cache only;
- per-user/team namespace;
- last-updated visible;
- stale status;
- logout/account-switch cleanup;
- reconnect refresh;
- no private player notes;
- no silent high-impact mutation queue unless explicitly designed.
