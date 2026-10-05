---
name: plan-vertical-slice
description: Plan one The Stable feature slice before implementation, including BDD, permissions, contracts, data, notifications, offline behaviour and test strategy.
---
# Plan Vertical Slice
1. Read ATRD, PLAN, ARCHITECTURE, PERMISSIONS, TESTING and relevant ADRs.
2. State actor, goal and non-goals.
3. Write happy-path BDD scenario.
4. Write unauthorized and wrong-tenant scenarios.
5. Add validation/failure/concurrency scenarios where relevant.
6. Identify source-of-truth ownership.
7. Identify required capability.
8. Define request/response/event contracts.
9. Identify schema/RLS/index impact.
10. Identify notification and offline impact.
11. List implementation worktrees/agent ownership.
12. List test layers and exact exit evidence.
Do not implement until Definition of Ready is satisfied.
