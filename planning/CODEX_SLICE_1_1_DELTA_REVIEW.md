# Slice 1.1 Remediation Delta Review

## Reviewed range

`8f4550dfc1cd2727f7bc060d358dd07aaf5807d9..a3b0fe7aa3f256883024abfc14534bf9a52bb4d0` on `main`. Reviewed only the delta and surrounding Slice 1.1 schema/functions. Changed files: the new uniform update-lookup migration, expanded pgTAP file, and planning review notes/artifact. No implementation code outside Slice 1.1 changed.

## M1-MED-01

**CLOSED**

`m1_club_structure_rls.sql` now tests active-member reads for each of the five tables; outsider, revoked-member, other-club-admin, and anonymous denial; authenticated direct INSERT/UPDATE/DELETE denial for every table; and anonymous write denial. Each of the nine mutation RPCs has active-admin success, and outsider, revoked, and other-club admin denial coverage. The ACL assertions check authenticated execute grants, absence of PUBLIC execute, and client-role denial for both helpers. Function bodies still authorize internally through active `CLUB_ADMIN` membership, so execute permission alone does not authorize mutations.

Successful create/update audit assertions check fixed action, `auth.uid()` actor, owning club, target, and a database-generated timestamp. `audit_events` direct writes are denied to authenticated and anon. The atomicity test creates a `pg_temp` trigger function and trigger after `BEGIN`, forces audit insertion to raise, then asserts the entity row and audit count are unchanged; both test objects are dropped before the final rollback. The failure mechanism is absent from production migrations.

## M1-LOW-01

**CLOSED**

`20261006010000_uniform_club_structure_update_lookup.sql` replaces all four update RPCs. Each target lookup combines the requested ID with an `EXISTS` check for the caller’s active `CLUB_ADMIN` membership in that target’s club. A failed lookup raises the same `NOT_FOUND`/`P0002` result before field validation or mutation. The SQLSTATE and message tests compare random missing IDs to real foreign-club IDs; additional outsider, revoked-member, and other-club-admin assertions verify the same external result. Each owning-club admin update remains covered as successful.

The lookup adds no caller-visible row data or alternate error path for an unauthorized target. It uses `auth.uid()` and does not accept a caller-supplied actor.

## Regression findings

### Critical

None.

### High

None.

### Medium

None.

### Low

None.

### Uncertain

The reported host execution results were reviewed but not independently rerun: frozen install, format, lint, typecheck, tests, web build, Supabase reset, 209 pgTAP assertions, auth bootstrap, integration, both Playwright suites, QA, and Security. This is execution evidence only; source-level findings above were independently checked.

## Scope control

The delta contains only the update-lookup migration, pgTAP expansion, and planning/review documentation. No auth-provider expansion, players, guardians, invitations, team membership, PlayHQ, attendance, notifications, Game Day, coaching stats, or practice planning work was started. Same-club wrong-team authorization remains intentionally deferred to Slice 1.4.

## Final recommendation

FREEZE SLICE 1.1
