# The Stable — Agent Instructions

This repository is governed by `planning/ATRD.md`, `planning/PLAN.md`, the ADRs, and the scoped `AGENTS.md` files below the root.

## Product
The Stable is a private junior-basketball operating system. V1 supports multiple Mentone Mustangs teams, with one U14 Boys team as the first live pilot. The design must remain themeable for future clubs.

## Architecture
"V architecture" in this repository means **Vertical Slice Architecture**. Business capabilities are organised by feature and behaviour, not horizontal controller/service/repository folders.

Primary stack:
- Expo / React Native / TypeScript for iOS + Android.
- Next.js / TypeScript on Vercel for club administration.
- Supabase for PostgreSQL, Auth, Storage, Realtime and server-side functions.
- pnpm workspace + Turborepo.
- TanStack Query for server state.
- React Hook Form + Zod for forms/contracts.
- Zustand only for small transient client state.
- Sentry for errors.
- PostHog for privacy-conscious product analytics.
- EAS for iOS and Android builds.

## Authority order
When instructions conflict, use this order:
1. Human instruction in the current task.
2. Approved ADRs in `planning/ADR/`.
3. `planning/ATRD.md`.
4. `planning/SECURITY.md` and `planning/PERMISSIONS.md`.
5. `planning/ARCHITECTURE.md`.
6. Nearest scoped `AGENTS.md`.
7. Root `AGENTS.md`.
8. Existing implementation conventions.

Never silently overturn a higher-authority decision. Propose an ADR instead.

## Non-negotiables
- Do not weaken security, RLS, validation, tenancy, privacy or tests to make a feature pass.
- Do not perform production Supabase, Vercel or EAS mutations unless the human explicitly approves the release step.
- Do not run destructive database commands against staging or production.
- Do not hard-code Mentone branding or IDs into domain logic.
- Do not create a single global `user.role`.
- Do not model Player and authenticated User as the same entity.
- Do not expose child full names by default to ordinary guardians.
- Do not implement unrestricted adult-to-child private messaging.
- Do not make child media public.
- Do not add packages or architectural layers without a concrete need.
- Do not bypass application operations for privileged/complex mutations.
- Do not let frontend role checks substitute for authorization.
- Do not merge work with failing required checks.

## Test-first delivery
Each vertical slice is developed with acceptance scenarios first, then failing tests, then implementation. Tests are part of the feature, not a follow-up phase.

Critical gates:
- 100% behaviour coverage of authorization capability matrix.
- Every RLS policy must have allow and deny tests.
- 100% branch coverage for critical permission/domain policy modules where practical and meaningful.
- MVP target: >=95% lines/statements/functions and >=90% branches in hand-written testable code, excluding generated code and explicitly documented exclusions.
- No merge may reduce meaningful coverage without an approved explanation.

## Parallel work
- Use isolated Cursor worktrees/branches for agents that edit code concurrently.
- Each agent receives explicit owned paths, read-only dependencies, acceptance criteria, required tests and forbidden changes.
- Shared contracts must be frozen or coordinated before parallel UI/backend implementation.
- The Integrator agent owns cross-worktree merging and conflict resolution.
- QA and Security agents independently verify merged candidate work; they do not rubber-stamp implementers.

## Human approval gates
Stop and request human approval before:
- changing the architecture style;
- changing identity/tenancy semantics;
- destructive or irreversible migrations;
- new paid infrastructure or materially higher-cost resources;
- production Supabase changes;
- production Vercel deployment;
- EAS production submission;
- weakening a test/security gate;
- replacing a primary dependency/platform;
- changing child-data privacy defaults.

## Required workflow
For each slice:
1. Read relevant planning docs and ADRs.
2. Define/update acceptance scenarios.
3. Confirm actor/capability/tenant/data ownership.
4. Define contracts.
5. Write failing tests.
6. Implement minimum coherent behaviour.
7. Add integration/RLS/component/E2E tests as required.
8. Run scoped test suite.
9. Run repo gates.
10. Request independent QA/security review when required.
11. Update docs if architecture/behaviour changed.
12. Return evidence: files changed, commands run, tests passed, known limitations.

## Documentation
Plans and decisions live under `planning/`.
Do not store secrets, access tokens, production identifiers or personal child data in planning files, fixtures or screenshots.
