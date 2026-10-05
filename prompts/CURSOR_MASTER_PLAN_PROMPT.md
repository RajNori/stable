# Cursor Master Plan-Mode Prompt

Use this as the **first prompt in Cursor Plan Mode** after copying the agentic pack into the greenfield repository.

---

We are building **The Stable**, a production-grade private junior basketball operating system.

Do **not** start implementation yet.

You are acting as the Engineering Lead in **Plan Mode**.

## Step 1 — Read the control plane

Read completely, in this order:

1. `AGENTS.md`
2. `README_AGENTIC.md`
3. `planning/ATRD.md`
4. `planning/PLAN.md`
5. `planning/ARCHITECTURE.md`
6. `planning/FEATURE_SCOPE.md`
7. `planning/DOMAIN_MODEL.md`
8. `planning/DATA_MODEL.md`
9. `planning/PERMISSIONS.md`
10. `planning/SECURITY.md`
11. `planning/TESTING.md`
12. `planning/INTEGRATIONS.md`
13. `planning/NOTIFICATIONS.md`
14. `planning/OFFLINE.md`
15. `planning/DESIGN_HANDOFF.md`
16. `planning/DESIGN_SYSTEM.md`
17. `planning/ENVIRONMENTS.md`
18. `planning/CI_CD.md`
19. `planning/RELEASE.md`
20. `planning/RISKS_AND_EDGE_CASES.md`
21. `planning/AGENT_WORKSTREAMS.md`
22. `planning/DEFINITION_OF_READY_DONE.md`
23. every accepted ADR under `planning/ADR/`
24. root/scoped Cursor rules, skills and custom subagents.

Do not skim. Build a dependency map from them.

## Step 2 — Inspect the repository

This is greenfield unless the repository shows otherwise.

Inspect:
- git status/history;
- current files;
- package manifests;
- existing design assets;
- environment examples;
- any existing app scaffolds.

Do not overwrite useful work.

## Step 3 — Confirm assumptions from the repo docs

Treat these as already decided unless the repository contradicts them:

- Vertical Slice Architecture.
- Expo iOS + Android.
- Next.js Club Admin on Vercel.
- Supabase PostgreSQL/Auth/Storage/Realtime/server functions.
- local + staging + production.
- multiple Mentone Mustangs teams in V1.
- one U14 Boys team is the first pilot.
- parent-managed child profiles; no player login in V1.
- phone OTP + email OTP/magic link + Apple + Google.
- manual fixture entry/import before PlayHQ credentials.
- PlayHQ becomes official source of truth for official fixture/result/ladder fields.
- team overlay always remains The Stable's data.
- Game Day critical snapshot is readable offline.
- announcements + acknowledgements, not unrestricted chat.
- private media is Wave 2.
- coaching stats + post-game review + thin practice planner are MVP.
- Club Admin web is MVP.
- contextual capabilities, not one `user.role`.
- safe reads may use Supabase under RLS; complex/privileged commands use explicit application operations.
- high meaningful test coverage with exhaustive critical authorization/RLS behaviour.
- concurrent implementation uses isolated worktrees.
- production mutations require human approval.

Do not re-litigate these choices unless you find a concrete contradiction or blocker.

## Step 4 — Design the implementation plan

Produce a detailed implementation plan for **Milestone 0 only**, plus a concise dependency preview for later milestones.

Milestone 0 plan must specify:
- proposed final directory tree;
- exact packages/apps to create;
- bootstrap dependency list and reason for each;
- version-pinning strategy;
- environment-variable taxonomy;
- Supabase local bootstrap;
- migration/test layout;
- TypeScript strict configuration;
- lint/format configuration;
- Vitest;
- React Native Testing Library;
- Playwright;
- Maestro scaffold;
- pgTAP;
- Sentry adapter;
- PostHog adapter;
- EAS profiles;
- Vercel preview/staging configuration;
- CI jobs;
- design-token scaffold;
- a trivial end-to-end vertical slice used only to prove architecture.

Do not install unnecessary libraries.

## Step 5 — Define parallel execution

Use the custom agents from `.cursor/agents`.

Propose workstreams for:
- platform/devops;
- mobile shell;
- web shell;
- Supabase foundation;
- domain/contracts/testing foundation;
- auth/permissions foundation.

Before parallel work:
- define file ownership;
- identify shared files that only the Integrator may edit;
- freeze initial contracts;
- define merge order.

Use isolated worktrees for concurrent editing agents.

Do not let multiple agents modify the same root config files concurrently.

## Step 6 — Define test-first acceptance

For every Milestone 0 workstream, list:
- expected failing test/check first;
- implementation;
- passing evidence;
- integration check.

Milestone 0 is not complete merely because both apps boot.

The exit proof is:
"A minimal authenticated current-user/current-club-context vertical slice can be exercised locally end-to-end and tested without production services."

## Step 7 — Identify blockers only

Ask me questions only for genuine blockers that cannot be answered from the documents or safely deferred.

Do not ask preference questions already settled by the docs.

If the design system is not final, keep UI styling at semantic-token scaffold level and continue infrastructure planning.

## Step 8 — Produce the plan, then STOP

Return:
1. architecture comprehension summary;
2. assumptions confirmed;
3. repository observations;
4. Milestone 0 detailed plan;
5. worktree/agent responsibility table;
6. shared-contract freeze list;
7. exact quality gates;
8. risks;
9. genuine blockers;
10. Definition of Done.

Do not write implementation code.
Do not run installs.
Do not create or mutate cloud infrastructure.
Do not deploy.
Do not start Supabase production.
Do not start parallel agents yet.

I will review the plan first.

Once I approve the plan, we will explicitly move to implementation and then use parallel agents/worktrees according to the approved dependency graph.
