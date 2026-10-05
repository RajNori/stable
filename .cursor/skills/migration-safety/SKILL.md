---
name: migration-safety
description: Validate a Supabase migration from a clean local database with constraints, RLS, data-safety and deployment risk checks.
---
# Migration Safety
1. Read DATA_MODEL and relevant ADR.
2. Classify additive / transforming / destructive.
3. Stop for human approval if destructive/irreversible.
4. Apply from clean local DB.
5. Run DB lint/tests.
6. Run RLS tests.
7. Regenerate DB types.
8. Validate existing tests.
9. Document backfill/lock/performance implications.
10. Never run against production.
