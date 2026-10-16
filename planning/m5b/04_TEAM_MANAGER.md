# Role Architecture — Team Manager

> **Audit baseline**
>
> Repository: `RajNori/stable`  
> PR: #3 — `milestone/5-pilot-hardening`  
> Current audited head: `5b8a7462a4b1d299421d6ed2c21e2a72ec714454`  
> Product / six-review SHA: `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb`
>
> Status labels: **IMPLEMENTED**, **PARTIAL**, **NOT IMPLEMENTED**, **DOMAIN ONLY**, **TARGET CHANGE**.


## Role mission

The Team Manager owns **weekly team logistics**.

Core outcome:

> The team gets to games and training with the right people, correct information, resolved duties and enough players — without WhatsApp being the system of record.

## Separation of concerns

### Owns / may manage
- own-team roster operations;
- manual fixtures;
- team overlay;
- schedule operations;
- training operations under current policy;
- announcements;
- duties/allocation/swaps;
- fill-ins.

### May read
- full own-team roster;
- team attendance;
- common Game Day information.

### Must not access
- M4 coaching stats;
- post-game review;
- private player notes;
- recognition;
- practice plans.

---

# Epic map

| Epic | Outcome |
|---|---|
| TM-E1 Access | Manager enters only assigned operational team. |
| TM-E2 Fixture/schedule | Weekly calendar is authoritative. |
| TM-E3 Roster/availability | Manager knows who can participate. |
| TM-E4 Announcements | Families receive authoritative updates. |
| TM-E5 Duties | Duties are assigned fairly and acknowledged. |
| TM-E6 Duty swaps | Families resolve conflicts atomically. |
| TM-E7 Fill-ins | Short rosters are resolved safely. |
| TM-E8 Training | Recurring/one-off training stays correct. |
| TM-E9 Needs Attention | Unresolved team operations are visible immediately. |

---

# TM-E1 — Access

## Story

As a Team Manager, I want access limited to my active assigned team so that I can operate the team without receiving club-wide authority.

**Current:** **IMPLEMENTED security / PARTIAL UX**.

Strong evidence:
- `team-manager.spec.ts` exercises a non-admin Manager;
- invitation acceptance;
- manual fixture create/update;
- team overlay;
- announcement;
- fill-in;
- duty allocation;
- M4 coaching panels explicitly absent.

## Gap

No Team Manager-specific home/context UX.

---

# TM-E2 — Fixtures and schedule

## Journey

```text
Manager Home
 -> next game
 -> fixture details
 -> edit manual/provider-allowed fields
 -> edit team overlay
 -> schedule
```

## TM-FIX-01 — Manual fixture

As a Team Manager, I want to create a manual fixture when official provider data is unavailable so that families can still plan.

**Current:** **IMPLEMENTED**.

## TM-FIX-02 — Source ownership

As a Team Manager, I want official/provider fields clearly separated from Stable-owned overlay fields so that I know what I may change.

**Current:** **IMPLEMENTED in data model/commands; UX can be clearer**.

## Gap
PlayHQ is not live. Manual mode is therefore still the operational truth.

---

# TM-E3 — Roster and availability

## TM-ROSTER-01 — Own-team roster management

As a Team Manager, I want to register/unregister players on my assigned team so that the active roster is operationally correct.

**Current:** **IMPLEMENTED** through the roster capability and DB/RLS tests.

## TM-AVAIL-01 — Availability board

As a Team Manager, I want attending/unavailable/unsure/unanswered status summarized so that I know whether action is required.

**Current:** **PARTIAL**. Underlying attendance exists; no Manager Home availability board.

### Privacy
Do not expose private absence detail beyond what Manager needs operationally.

---

# TM-E4 — Announcements

## Story

As a Team Manager, I want to publish an authoritative team update and know whether required recipients have acknowledged it.

**Current:** **IMPLEMENTED web**; mobile supports receiver read/ack.

## Integration gap

Real push is not completed. Publishing an announcement cannot yet be considered a full "replace chat" journey.

### Acceptance for Done
- persisted announcement;
- recipient resolution;
- preferences;
- revoked user excluded at delivery;
- push payload contains no sensitive child information;
- delivery/invalid token handled;
- mobile deep link opens relevant update.

---

# TM-E5 — Duties

## Journey

```text
Game
 -> duty required
 -> manual assign OR allocation preview
 -> commit
 -> assignee notified
 -> assignee acknowledges
```

## Current

**IMPLEMENTED strongly in domain/web/DB**:
- duty creation;
- fair allocation preview/commit;
- acknowledgement;
- assignment state;
- E2E evidence.

## Cross-role gap

Guardian native acknowledgement is missing. A Manager workflow is not product-complete until the assignee can respond conveniently on mobile.

---

# TM-E6 — Duty swaps

## Story

As a Team Manager, I want duty swaps to resolve atomically so that two adults cannot both believe they accepted the same duty.

**Current:** **IMPLEMENTED domain/DB/web** with race-oriented design.

## Mobile gap

Parent-native request/accept is absent.

## RCA

M3 correctly prioritized transactional integrity, but user-journey completion across both roles lagged.

---

# TM-E7 — Fill-ins

## Journey

```text
short roster
 -> manager requests N fill-ins
 -> eligible guardians/players respond
 -> manager reviews responses
 -> manager confirms
 -> Game Day reflects confirmed state
```

## Current

**IMPLEMENTED web/domain** with several M3 remediation migrations for lifecycle/invariant correctness.

## Gap

Guardian native response is absent. Mobile only displays fill-in state.

## Story TM-FILL-01

As a Team Manager, I want response and confirmation to remain separate states so that I choose the final fill-in and never overfill the team.

Current domain aligns.

---

# TM-E8 — Training operations

## Current

**IMPLEMENTED web/domain** for:
- one-off session;
- recurring weekly series;
- coach check-in;
- schedule visibility.

## Gaps
- native training detail/action surface;
- role-home alerting for changes;
- richer recurrence edit UX where one/this-and-future/series behavior is required.

---

# TM-E9 — Needs Attention

## Target

```text
Team Manager Home

Next game
3 unanswered RSVPs
1 unassigned duty
1 fill-in still required
4 required announcement acknowledgements missing
Training changed
```

**Current:** **NOT IMPLEMENTED as aggregate UX**.

## Architecture

Create a safe Manager Home projection:
- counts + safe labels;
- exact action links;
- no coaching-private content;
- no sensitive absence notes.

Do not compose it from many ad hoc client queries.

---

# Current evidence mapped to Team Manager

**Strong**
- `team-manager.spec.ts`
- roster RLS
- fixture RLS
- attendance RLS
- announcements RLS
- duties/swap RLS
- fill-in lifecycle/invariant RLS
- training domain
- capability separation from M4 coaching

**Missing/partial**
- Manager Home;
- real push;
- Guardian native response side;
- hosted staging;
- PlayHQ.

---

# RCA summary

The Team Manager implementation proves a lot of manager-side behavior. The missing acceptance spine is:

> "Can a Manager operate the entire weekend while families use the mobile app?"

The browser E2E proves the initiating side. It does not prove the receiving mobile side.

This is a cross-role planning gap, not poor domain engineering.

---

# Team Manager hosted journey

```text
1. authenticate
2. select assigned team
3. Manager Home shows unresolved work
4. create/update fixture
5. inspect availability
6. publish announcement
7. verify real push on device
8. assign duty
9. Guardian acknowledges on mobile
10. Guardian requests swap
11. eligible adult accepts
12. request fill-in
13. Guardian responds on mobile
14. Manager confirms
15. Game Day reflects final state
16. attempt coaching-private surface -> denied
```

---

# Remediation priorities

## P0
- hosted staging;
- Manager Home;
- Guardian RSVP/duty/fill-in native actions;
- real push.

## P1
- richer training-change UX;
- PlayHQ when available.

## P2
- fairness/operations reporting.

---

# Definition of Done — Team Manager pilot

A Manager can run a normal basketball weekend without core coordination falling back to WhatsApp, and every Manager-initiated request has a usable receiving experience on the parent's phone.
