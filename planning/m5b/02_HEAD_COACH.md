# Role Architecture — Head Coach

> **Audit baseline**
>
> Repository: `RajNori/stable`  
> PR: #3 — `milestone/5-pilot-hardening`  
> Current audited head: `5b8a7462a4b1d299421d6ed2c21e2a72ec714454`  
> Product / six-review SHA: `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb`
>
> Status labels: **IMPLEMENTED**, **PARTIAL**, **NOT IMPLEMENTED**, **DOMAIN ONLY**, **TARGET CHANGE**.


## Role mission

The Head Coach owns the **basketball loop** for an assigned team.

The product should let the coach answer:

1. Who is available?
2. What do I need for this game?
3. What happened?
4. What do we need to improve?
5. What are we doing at the next practice?

## Separation of concerns

### Owns / may execute
- team coaching context;
- full operational roster view;
- team attendance read;
- fixture overlay where policy permits;
- training management;
- coach check-in;
- announcements under current policy;
- fill-ins under current policy;
- M4 coaching stats;
- post-game review;
- recognition;
- private player notes;
- practice planning.

### Does not own solely as Head Coach
- club structure;
- global people management;
- staff assignment;
- player registration changes unless separately granted;
- duty management under current capability rules;
- imported/provider-owned result mutation;
- another team's coaching data.

---

# Epic map

| Epic | Outcome |
|---|---|
| HC-E1 Access/context | Coach enters exact assigned team safely. |
| HC-E2 Pre-game readiness | Coach understands availability and game details. |
| HC-E3 Game Day | Critical context is dependable online/offline. |
| HC-E4 Score/stats | Stable-owned result and simple stats are captured safely. |
| HC-E5 Review/private notes | Game learning is recorded securely. |
| HC-E6 Recognition | Positive behaviours are captured without public ranking. |
| HC-E7 Practice planning | Review insights become next practice. |
| HC-E8 Communication/fill-ins | Coach can act where operational policy grants authority. |

---

# HC-E1 — Access and team context

## Journey

```text
authenticate
 -> restore adult
 -> resolve active team memberships
 -> choose team if needed
 -> Coach Home
```

## HC-CTX-01 — Team selection

**Story**  
As a Head Coach with one or more assignments, I want an explicit active-team context so that every coaching action is obviously scoped.

**Acceptance**
- only active permitted teams appear;
- selected team is visible;
- switch invalidates/reloads team-scoped cache;
- no server/RLS decision trusts the UI selection as authorization;
- private/offline data cannot bleed from previous team;
- revoked team disappears on next authoritative refresh.

**Current:** **PARTIAL**.
- contextual membership/security is strong;
- mobile context can list eligible teams;
- polished team switcher / Coach Home is missing.

## RCA

The authorization model is ahead of the navigation model. Team context was solved as a security fact, not fully as a role experience.

---

# HC-E2 — Pre-game readiness

## Target journey

```text
Coach Home
 -> Next Game
 -> availability
 -> unanswered players
 -> open fill-in state
 -> arrival/venue/court/uniform
 -> coach focus
 -> roster
```

## HC-READY-01 — Availability summary

As a Head Coach, I want a clear availability summary before the game so that I can prepare rotations and identify shortages.

**Acceptance**
- ATTENDING/UNAVAILABLE/UNSURE/UNANSWERED differentiated;
- private absence notes not overexposed;
- active team only;
- latest authoritative state;
- fill-in need visible without making Coach the Manager by default.

**Current:** **PARTIAL**.
Underlying attendance/Game Day/fill-in data exists. There is no purpose-built Coach Home.

## Remediation

Create one `coach_home_projection` returning:
- next game;
- attendance counts;
- unresolved fill-in;
- next training;
- previous review status;
- safe navigation targets.

No private player-note text on Home.

---

# HC-E3 — Game Day

## Current strengths

**PARTIAL but technically strong**.

Web Game Day includes:
- projection;
- RSVP/duty/fill-in operations where caller capability allows;
- score/stat panel;
- review/private-note/recognition panel.

Mobile includes:
- opponent/round;
- own duty/RSVP/fill-in projection;
- availability summary;
- robust offline Game Day snapshot.

## HC-GD-01 — Coach Game Day

**Story**  
As a Head Coach, I want a coach-optimized Game Day view so that availability, team focus and game logistics are available without navigating through admin surfaces.

**Acceptance**
- exact assigned team;
- current fixture source/status;
- arrival/venue/court/uniform;
- team attendance summary;
- open fill-in state;
- coach focus;
- no unrelated guardian contact details;
- no private notes in offline snapshot.

**Gap**
Mobile is a generic safe Game Day projection, not yet a fully intentional coach workflow.

## HC-GD-02 — Offline

As a Head Coach in poor reception, I want the last authorized Game Day snapshot while accepting that writes remain disabled until an authoritative refresh succeeds.

**Current:** **IMPLEMENTED strongly** at the shared mobile offline boundary. Retain this design.

---

# HC-E4 — Final score and player statistics

## Current

**IMPLEMENTED strongly** on web/domain/DB.

Implemented rules include:
- manual Stable-owned final score;
- paired score constraints;
- imported/provider-owned result protection;
- points/rebounds/assists/steals/fouls bounds;
- approximate minutes bound;
- current registration required for new stat line;
- current authorized coach can correct historical line after transfer;
- immutable restricted numeric correction history;
- actor attribution;
- exact-team Head/Assistant Coach authorization;
- legacy fixture mutation cannot bypass score authorization.

Authenticated Playwright covers the coach score/stats flow.

## HC-STATS-01 — Record stats

As a Head Coach, I want to capture simple bounded statistics after a game so that coaching decisions have lightweight evidence without turning The Stable into an advanced analytics platform.

## HC-STATS-02 — Correct stats

As a Head Coach, I want to correct a genuine data-entry error while retaining restricted numeric history so that the record is trustworthy.

## Channel gap / decision

Dense stats editing is not implemented as a mobile coaching workflow.

### Recommended pilot decision

Use responsive web/tablet as the primary stats/review/planning surface. Keep mobile focused on fast pre-game/Game Day operations until pilot proves that phone stat entry is necessary.

This is a product-channel decision, not a missing backend feature.

---

# HC-E5 — Post-game review and private notes

## HC-REV-01 — Team review

As a Head Coach, I want one authoritative game review containing what worked and what needs improvement so that observations are not lost.

**Current:** **IMPLEMENTED**.

## HC-PRIV-01 — Private player note

As a Head Coach, I want private player-development notes visible only to the current coaching staff on that exact team.

**Acceptance**
- Club Admin-only denied;
- Team Manager denied;
- Guardian denied;
- revoked coach denied;
- other-team coach denied;
- no offline cache;
- no push payload;
- no analytics payload;
- no generic audit note text.

**Current:** **IMPLEMENTED/security strong**. M5 further serialized private-note writes and tightened audit context.

---

# HC-E6 — Recognition

## Story

As a Head Coach, I want to record positive recognition such as Player of Game, Hustle, Defence or Teamwork so that desirable behaviours can be remembered without creating a public leaderboard.

**Current:** **IMPLEMENTED staff-facing**.

## Gap / recommendation

Do not expose recognition automatically to Guardian/Player UI during pilot. Publication semantics belong to a separate product decision.

---

# HC-E7 — Practice planning

## Journey

```text
Post-game review
 -> select focus
 -> next training
 -> create/open plan
 -> timed blocks
 -> drills
 -> reorder
 -> save
```

## Current

**IMPLEMENTED strongly** on web/domain:
- training-linked plan;
- reusable templates;
- drill library;
- timed blocks;
- stable ordering;
- duplicate prior plan;
- focus snapshot;
- duration invariants.

## HC-PLAN-01 — Review-to-practice handoff

As a Head Coach, after completing a game review I want the next training plan one action away so that the game-to-practice feedback loop is obvious.

**Gap:** navigation/orchestration. Domain is already there.

## Remediation

Add "Plan next practice" action from review and Coach Home. Avoid copying private notes into plan automatically.

---

# HC-E8 — Communication and fill-ins

## Current capability

Head Coach can currently:
- publish announcements;
- manage fill-ins;
- manage training;
- edit permitted fixture overlay.

## SOC recommendation

The Team Manager remains operational primary. Head Coach authority is an exception path for team continuity, not a reason to duplicate the Manager information architecture.

## Story

As a Head Coach, I want shortages visible and a permitted fill-in action available when necessary so that the basketball team can function if the Manager is unavailable.

---

# Current evidence mapped to Head Coach

**Strong**
- `m4-coaching.spec.ts`
- `cross-team-denial.spec.ts`
- M4 stats/review/planner pgTAP suites
- M5 coaching audit hardening
- full roster projection
- revoked staff coverage
- offline Game Day tests

**Still missing**
- hosted staging proof;
- Coach Home;
- role/team switch UX;
- explicit channel ownership for stats/planning;
- real push.

---

# RCA — why coaching is technically mature but product orchestration is incomplete

M4 was explicitly defined as a coaching loop, so it received coherent domain and browser E2E treatment. Mobile did not receive an equivalent role-specific coaching milestone.

This is primarily a **channel/orchestration gap**, not a domain gap.

Coverage is strong because the web workflow is real. The remaining question is where each coach task should live, not whether the domain exists.

---

# Head Coach critical hosted journey

```text
1. authenticate in staging
2. select assigned team
3. Coach Home shows next game/readiness
4. inspect full roster and availability
5. other-team coaching request denied
6. game occurs
7. record final score and player stats on primary coaching surface
8. complete review
9. save one private player note
10. record recognition
11. choose focus
12. create next practice plan
13. Admin revokes coaching membership
14. next M4 read/write is denied immediately
```

---

# Remediation priority

## P0
- hosted staging;
- auth target;
- Coach Home/team switch;
- role smoke;
- choose primary channel for dense coaching commands.

## P1
- mobile coach-specific Game Day polish;
- review-to-practice deep navigation;
- real push for coach-relevant events.

## P2
- richer coaching analysis only after pilot evidence.

---

# Definition of Done — Head Coach pilot

- exact-team hosted authorization proven;
- coach sees next basketball action immediately;
- score/stats/review/practice loop works;
- private notes remain coach-only;
- revocation is immediate;
- offline remains read-only/fail-closed;
- no coaching-private content in push, analytics or generic logs.
