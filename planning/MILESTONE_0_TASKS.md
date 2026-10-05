# Milestone 0 — Agent Task Board

This board is a template for Cursor Plan Mode. The Integrator should adapt exact file names after inspecting the greenfield repo.

## Shared pre-work — Integrator only
- establish final root tree;
- choose/pin runtime versions;
- create root workspace config;
- create base tsconfig/lint/format policy;
- create environment naming contract;
- define first architecture-proof vertical slice contract;
- mark single-writer shared files.

No parallel agent edits root config before this step is committed.

---

## Workstream A — Platform / DevOps

### Own
CI, Vercel/EAS scaffolding, env validation infrastructure.

### Acceptance
- lockfile install works;
- local/staging/prod taxonomy encoded;
- EAS development/preview/production profiles exist;
- CI runs format/lint/type/unit/DB as available;
- no production deploy action runs automatically.

### Tests/evidence
- config parse;
- dry build/config validation;
- CI syntax validated.

---

## Workstream B — Mobile Shell

### Own
`apps/mobile/**`

### Acceptance
- Expo app boots;
- router shell;
- provider composition;
- semantic design-token consumption;
- auth/session placeholder boundary;
- accessible initial screen;
- test harness green.

### Not yet
No final visual styling until design system approval.

---

## Workstream C — Web Shell

### Own
`apps/web/**`

### Acceptance
- Next.js app boots/builds;
- admin shell;
- auth/session boundary;
- semantic tokens;
- error/loading boundary;
- test harness;
- Playwright smoke.

---

## Workstream D — Supabase Foundation

### Own
`supabase/**`

### Acceptance
- local start documented;
- first migration;
- RLS test harness;
- seed approach;
- clean reset/rebuild;
- generated type command;
- architecture-proof tables only, not premature full schema.

### Important
Do not start multiple default local Supabase stacks across worktrees without coordination.

---

## Workstream E — Domain/Contracts/Test Foundation

### Own
domain/contracts/testing packages as assigned.

### Acceptance
- package boundaries compile;
- Zod contract convention;
- application error convention;
- fake-port testing convention;
- one trivial use case proving the pattern.

---

## Workstream F — Auth/Permissions Foundation

### Own
auth/permissions packages and architecture-proof capability evaluation.

### Acceptance
- no single `user.role`;
- context shape;
- capability evaluator interface;
- tests proving allow/deny;
- no provider-specific identity assumptions leaking into domain.

---

## Architecture-proof vertical slice

Use a deliberately small slice such as:

`GetCurrentClubContext`

Purpose:
- prove authenticated principal reaches application boundary;
- query active club membership/context;
- return stable contract;
- enforce RLS/authorization;
- render on mobile and web;
- test end-to-end locally.

Do not expand this into full Club CRUD during Milestone 0.

## Merge order
1. Integrator shared root.
2. Domain/contracts + Supabase foundation.
3. Auth/permissions foundation.
4. Mobile/web shells.
5. Platform integration.
6. Architecture-proof slice.
7. QA/security review.

## Exit
All Milestone 0 Definition of Done items green and the proof slice works without production services.
