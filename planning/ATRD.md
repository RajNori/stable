# ATRD — Agentic Team Requirements Document

**Product:** The Stable  
**Initial tenant:** Mentone Mustangs Basketball Club  
**Initial pilot:** one U14 Boys team  
**V1 tenancy:** multiple Mentone Mustangs teams  
**Future boundary:** multi-club capable without implementing SaaS billing/club onboarding yet  
**Architecture:** Vertical Slice Architecture ("V architecture")  
**Status:** authoritative planning document

---

## 1. Purpose

This document defines how a coordinated team of coding agents will design, implement, test, integrate and release The Stable without allowing parallel work to create architectural drift, permission gaps, duplicated logic, brittle tests or technical debt.

The agents are not autonomous product owners. They implement approved requirements inside explicitly bounded areas. Human review remains the approval desk for architecture, security, destructive data changes and production release.

---

## 2. Product mission

The Stable is a private junior basketball team operating system.

It should replace fragmented weekly coordination across fixtures, messaging, spreadsheets and ad-hoc parent communication with one clear system for:

- weekend games;
- official fixtures/results/ladders;
- team-specific Game Day information;
- attendance/availability;
- recurring training;
- practice planning;
- coach check-in;
- scorebench/parent duties;
- duty swaps and automatic fair rotation;
- fill-in requests;
- announcements and acknowledgement;
- push notifications;
- coach post-game statistics and review;
- club/team administration.

Wave 2 adds:
- private media/gallery;
- player development;
- challenges and achievements;
- richer coach feedback;
- season summaries.

---

## 3. Actors

### Guardian
Authenticated adult who manages one or more Player profiles and may simultaneously hold staff roles.

### Head Coach
Team-level role with coaching capabilities.

### Assistant Coach
Team-level role with delegated coaching capabilities.

### Team Manager
Team-level operational role.

### Club Admin
Club-level administration role.

### Player
A child profile in V1, **not an authenticated user**. Player authentication is explicitly deferred.

A single User may be Guardian + Coach + Manager at the same time. Authorization is contextual and capability-based.

---

## 4. Product principles

1. **Parent clarity:** A guardian should know what matters for the next basketball event within 10 seconds.
2. **Coach utility:** Stats, review and practice planning exist to support coaching decisions.
3. **Operational truth:** PlayHQ is authoritative for official fixture/result/ladder fields once integrated.
4. **Team overlay:** The Stable owns arrival time, availability, duties, notes, practice, fill-ins and team communication.
5. **Privacy by default:** Children are not public content.
6. **No unhealthy ranking:** No public player leaderboards in MVP.
7. **Offline essentials:** cached read-only Game Day essentials remain visible with poor connectivity.
8. **Themeability:** Mustangs branding is a theme, not domain logic.

---

## 5. Core MVP

### Identity and tenancy
- multiple Mustangs teams;
- club, season, competition, team and venue;
- adult authentication;
- player profiles;
- guardian-player relationships;
- contextual club/team roles;
- invitation flows.

### Authentication
- Australian phone OTP;
- email OTP/magic link;
- Sign in with Apple;
- Sign in with Google;
- account linking/identity collision behaviour defined before implementation.

### Team operations
- roster;
- schedule;
- manual fixture entry/import;
- PlayHQ adapter boundary ready from day one;
- Game Day;
- availability;
- recurring training;
- coach check-in;
- announcements + acknowledgement;
- notifications;
- duties;
- manual duty assignment;
- fair automatic duty rotation with preview;
- duty swaps;
- fill-ins.

### Coaching
- final game score;
- player points;
- rebounds;
- assists;
- steals;
- fouls;
- approximate minutes/court time;
- team notes;
- private player notes;
- MVP/Player of the Game;
- recognition categories such as Hustle, Defence and Teamwork;
- post-game review;
- thin practice planner:
  - drills;
  - timed blocks;
  - reordering;
  - notes;
  - duplicate previous;
  - reusable template;
  - training linkage;
  - carry post-game focus into next practice.

### Administration
- proper Club Admin web surface from V1;
- teams;
- people;
- roster;
- schedule;
- training;
- announcements;
- staff assignments;
- audit visibility where appropriate.

---

## 6. Explicit non-goals for MVP

- payments;
- competition registration replacement;
- official game scoring replacement;
- unrestricted chat;
- adult-child direct messaging;
- public profiles;
- public gallery;
- merchandise;
- advanced performance analytics;
- AI-generated coaching;
- multi-club billing;
- club self-service onboarding;
- official medical record storage.

---

## 7. Design system status

The V1 visual direction is approved and frozen for implementation.

Authoritative design references:
- `planning/DESIGN_SYSTEM.md`
- `design/stable-v1-final.png`
- `planning/DESIGN_HANDOFF.md`

Agents implement this system; they do not create an alternative visual language.

---

## 8. Architecture constraints

See `ARCHITECTURE.md`.

Required principles:
- vertical slices;
- contract-first parallelism;
- PostgreSQL as system of record;
- direct Supabase reads only where RLS makes them safe;
- business-significant/privileged mutations through explicit application operations;
- platform-neutral domain rules;
- strict tenant scoping;
- anti-corruption layer for PlayHQ;
- event-driven notification decisions;
- explicit offline cache boundary;
- no business logic hidden in UI components.

---

## 9. Data-source ownership

### PlayHQ-owned official fields
When API access exists:
- official competition;
- official round;
- opponent;
- official scheduled start;
- official venue/court where supplied;
- fixture status;
- result/final score;
- ladder.

### The Stable-owned fields
- arrival time;
- uniform note;
- coach message;
- RSVP/attendance;
- duties;
- fill-ins;
- practice;
- internal notes;
- internal stats/observations;
- recognition;
- notification state.

Before PlayHQ credentials exist, manual/imported official fields are accepted through the same internal fixture contract and tagged `source=MANUAL`. Migration to `PLAYHQ` must not destroy team-owned overlay data.

---

## 10. Privacy and safeguarding

Default guardian-facing child identity is first name + surname initial.

Full child identity is available only where an authorized coach/manager/admin needs it.

No public roster.
No unrestricted child search.
No public media bucket.
No unnecessary location tracking.
No child names in analytics.
No absence reason visible to unrelated guardians.
No private adult-child messaging.
No production personal data in tests.

See `SECURITY.md` and `PERMISSIONS.md`.

---

## 11. Test philosophy

We use BDD at the feature/acceptance level and TDD heavily in domain/application code.

Every story includes:
- positive scenario;
- authorization denial scenario;
- tenant-boundary scenario where applicable;
- validation scenario;
- failure/retry scenario where applicable;
- concurrency/idempotency scenario where applicable.

Tests are authored during implementation.

Quality is not measured only by a percentage. Coverage targets exist to catch omissions, while behaviour matrices prove the important rules.

See `TESTING.md`.

---

## 12. Agent topology

The default implementation team:

1. Integrator / Engineering Lead
2. Mobile
3. Web Admin
4. Domain/Application
5. Supabase/Data/RLS
6. Auth/Permissions
7. PlayHQ/Integrations
8. Notifications
9. Storage/Media (Wave 2 active, MVP policies scaffolded)
10. QA/Adversarial
11. Security Reviewer
12. Platform/DevOps

Agents use isolated worktrees for concurrent code changes.

No agent may widen its scope simply because a neighbouring implementation is incomplete.

See `AGENT_WORKSTREAMS.md`.

---

## 13. Definition of Ready

No feature implementation begins until:
- actor and goal are known;
- acceptance scenarios exist;
- tenant scope is known;
- capability requirements are known;
- source-of-truth ownership is known;
- contract is defined;
- persistence impact is understood;
- offline/notification impact is considered;
- test strategy is listed;
- UX/design state exists or feature is explicitly non-visual.

---

## 14. Definition of Done

A feature is Done only when:
- acceptance criteria pass;
- required tests were added with the feature;
- authorization/RLS is proven where relevant;
- errors are handled;
- loading/empty/offline states exist where relevant;
- observability is added where relevant;
- documentation reflects behaviour;
- typecheck/lint/build pass;
- no unresolved Critical/High review issue;
- QA independently verifies critical journeys;
- no required TODO is hidden as future work.

---

## 15. Human checkpoints

Mandatory human approval:
- ADR changing architecture;
- identity/authorization model;
- destructive migration;
- new paid infrastructure;
- production DB action;
- production deploy;
- production EAS submission;
- material privacy-policy change;
- weakening test/security gates.

---

## 16. Delivery sequence

Milestone 0 — engineering foundation  
Milestone 1 — identity, club/team, permissions, roster  
Milestone 2 — fixtures, Game Day, training, attendance, offline cache  
Milestone 3 — announcements, notifications, duties, fill-ins  
Milestone 4 — coaching stats, post-game review, practice planner  
Milestone 5 — hardening, pilot release  
Wave 2 — media + player development/challenges

Dependencies are detailed in `PLAN.md`.
