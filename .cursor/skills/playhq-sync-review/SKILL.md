---
name: playhq-sync-review
description: Review fixture/result synchronization for provider isolation, source-of-truth ownership, idempotency and local-overlay preservation.
paths:
  - "integrations/playhq/**"
  - "packages/features/fixtures/**"
---
# PlayHQ Sync Review
Verify:
- provider DTO isolation;
- manual-source coexistence;
- deterministic matching;
- no overlay overwrite;
- change detection;
- cancellation/postponement;
- duplicate prevention;
- outage/rate-limit safety;
- sync-run evidence;
- tests.
