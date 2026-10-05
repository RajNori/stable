# Agent Workstreams

## Orchestration model

Use a parent Integrator agent with specialised subagents. Concurrent editing agents should run in isolated worktrees/branches.

The parent must give each subagent:
- objective;
- owned paths;
- read-only dependencies;
- acceptance criteria;
- required tests;
- forbidden changes;
- expected return evidence.

---

## 1. Integrator / Engineering Lead

Owns:
- architecture enforcement;
- task decomposition;
- contract freeze;
- dependency ordering;
- worktree integration;
- conflict resolution;
- milestone verification.

Does not:
- casually rewrite every agent's work;
- bypass QA;
- change ADRs silently.

Must read all planning docs.

---

## 2. Mobile Agent

Primary owned paths:
- `apps/mobile/**`
- mobile-specific tests

Responsibilities:
- Expo Router;
- auth UX;
- parent Home;
- Game Day;
- Schedule;
- Training;
- announcements;
- duties;
- notifications;
- offline snapshot UX;
- coach-capability surfaces;
- accessibility/responsive mobile behaviour.

Forbidden:
- DB migrations;
- RLS;
- service-role logic;
- inventing business rules;
- final colors before approved design system.

---

## 3. Web Admin Agent

Owned:
- `apps/web/**`

Responsibilities:
- Club Admin;
- teams/people/roster;
- schedule/training management;
- announcements;
- duty/fill-in administration;
- coach tools on web;
- responsive admin;
- Playwright.

Forbidden:
- weakening server authorization because route is "admin only";
- modifying DB schema directly.

---

## 4. Domain/Application Agent

Owned:
- `packages/domain/**`
- `packages/features/**`
- relevant unit/application tests

Responsibilities:
- use cases;
- state machines;
- policy logic;
- contracts in coordination with contract owner/integrator;
- stats validation;
- recurrence behaviour;
- duty allocator;
- post-game/practice flow.

Forbidden:
- importing React/Next/Expo;
- direct provider SDK dependencies in domain;
- changing tenancy model.

---

## 5. Supabase/Data/RLS Agent

Owned:
- `supabase/**`
- generated DB type workflow

Responsibilities:
- migrations;
- constraints;
- indexes;
- RLS;
- SQL/RPC where justified;
- pgTAP;
- seed;
- local database reproducibility.

Exclusive coordinator for local DB changes during concurrent work.

Forbidden:
- production migration;
- Dashboard-only schema change;
- destructive migration without approval.

---

## 6. Auth/Permissions Agent

Owned:
- `packages/auth/**`
- `packages/permissions/**`
- auth-related server operations/tests

Responsibilities:
- phone/email/Apple/Google auth integration;
- identity-linking rules;
- invitations;
- capability evaluator;
- revoked-access behaviour;
- auth security tests.

Must coordinate schema with Data agent.

---

## 7. Integration Agent

Owned:
- `integrations/playhq/**`
- integration fixtures/tests

Responsibilities:
- provider client;
- DTOs;
- mapper;
- reconciliation;
- idempotency;
- sync-run reporting;
- outage/rate-limit behaviour.

Must not leak provider types into app/domain.

---

## 8. Notification Agent

Owned:
- `packages/notifications/**`
- notification server adapter/functions/tests

Responsibilities:
- event->recipient policy;
- device endpoints;
- push adapter;
- delivery logs;
- duplicate suppression;
- invalid-token handling.

---

## 9. Storage/Media Agent

MVP: scaffold policies/contracts only as needed.
Wave 2: private media.

Owned:
- storage policy/function areas assigned by Integrator;
- media slice.

Cannot make buckets public.

---

## 10. QA / Adversarial Agent

Read-wide, edit only tests/reports unless assigned.

Responsibilities:
- independent acceptance review;
- regression gaps;
- abuse cases;
- concurrency;
- E2E;
- coverage gap analysis;
- `planning/REVIEW.md`.

Must state PASS/FAIL/UNCERTAIN with evidence.

---

## 11. Security Reviewer

Independent reviewer.

Responsibilities:
- trust-boundary review;
- RLS;
- service-role use;
- IDOR;
- token/secret leakage;
- child privacy;
- storage exposure;
- auth linking;
- logs/analytics.

Does not approve based only on passing tests.

---

## 12. Platform/DevOps Agent

Owned:
- CI;
- Vercel config;
- EAS config;
- environment validation;
- safe deployment scripts/docs.

No production action without human approval.

---

## Handoff contract

Every implementer returns:
1. branch/worktree;
2. files changed;
3. architecture assumptions;
4. tests added;
5. commands run;
6. exact pass/fail summary;
7. known limitations;
8. migrations/config changes;
9. questions requiring Integrator/human.

No "done" without evidence.
