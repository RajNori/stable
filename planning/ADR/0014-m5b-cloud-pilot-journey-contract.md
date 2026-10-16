# ADR 0014 — M5B Cloud Pilot Journey Contract

Status: Accepted for M5B implementation by the product owner

## Context

The M5 audit found the existing vertical slices, Supabase Auth, contextual
capabilities, RLS, offline boundaries and local test architecture sound. The
remaining risk is missing end-to-end role journeys and hosted-system proof.
Historical shared-provider authentication requirements also conflict with the
new approved product journeys.

## Decision

Preserve Vertical Slice Architecture, Supabase Auth/Postgres/RLS, trusted
command boundaries, contextual capabilities, local deterministic CI and
current privacy boundaries. M5B completes user journeys over these contracts;
it does not replace them.

The approved client authentication split is:

- Web dashboard: Google, Facebook, email/password. Password recovery uses a
  neutral reset request and Supabase's single-use recovery session/link.
- Mobile: Australian SMS OTP by default; email magic-link/deep-link as the
  alternative. No mobile password login or automatic Google/Facebook sign-in.
- Player: no authenticated account in V1. Supabase Auth remains the identity
  authority; authentication does not grant membership/capability.

Invitation acceptance proves the intended verified phone/email identity,
current target context and one-time active invitation. Google/Facebook email
must be verified to satisfy an email-bound invite. Never auto-match by name or
child relationship, or silently merge existing adult identities.

The M5B pilot surfaces are Guardian mobile iOS, Team Manager web, Head/Assistant
Coach web where assigned capabilities apply, and Club Admin web. Public web is
out of scope. Android is P1 unless named in the first cohort. PlayHQ remains an
external P1 dependency with manual fixture fallback.

All Club Admin, Manager, Coach and Guardian home aggregates are
server/domain projections under caller authorization, not client-side
cross-scope aggregation. All new mutations preserve authoritative capability
and RLS checks. No offline mutation queue is introduced.

Hosted Supabase is used only after staging identity is proven distinct from
production. Local Supabase remains the environment for CI, migrations, pgTAP,
destructive tests, concurrency tests and disposable E2E. A staging seed must be
synthetic, idempotent and guarded by app environment, project allowlist,
production denylist and explicit confirmation.

## Consequences

- `AUTH.md`, `PERMISSIONS.md`, release/test plans and
  `M5B_TRACEABILITY_MATRIX.md` define the executable contract.
- M5 evidence and role-pack historic status are preserved as historical
  records; new implementation/hosted/device results are recorded separately.
- External provider/account credentials, hosted mutations, Sentry destination,
  store signing and destructive restore remain human gates.
- `M5B_TRACEABILITY_MATRIX.md` is the completeness ledger. P0 missing hosted
  evidence and required physical-iPhone journeys block Pilot GO.
