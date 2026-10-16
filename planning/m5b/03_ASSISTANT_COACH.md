# Role Architecture — Assistant Coach

> **Audit baseline**
>
> Repository: `RajNori/stable`  
> PR: #3 — `milestone/5-pilot-hardening`  
> Current audited head: `5b8a7462a4b1d299421d6ed2c21e2a72ec714454`  
> Product / six-review SHA: `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb`
>
> Status labels: **IMPLEMENTED**, **PARTIAL**, **NOT IMPLEMENTED**, **DOMAIN ONLY**, **TARGET CHANGE**.


## Role mission

The Assistant Coach is a **team-scoped coaching collaborator**.

Frozen M4 policy: an active Assistant Coach has the same M4 coaching capabilities as an active Head Coach for the exact assigned team. There is no per-assistant delegation system in MVP.

The role should remain easy to explain:

> "Coach on this team" does not mean "club administrator" or "team manager".

## Separation of concerns

### M4 coaching authority
- coaching stats read/write;
- post-game review read/write;
- recognition read/write;
- private player note read/write;
- practice-plan management;
- coach check-in.

### Read access
- full assigned-team roster;
- fixtures/schedule;
- announcements;
- team attendance as authorized.

### Not automatically granted
- club structure;
- people management;
- staff assignment;
- roster management;
- manual fixture management;
- duty management.

### Important current policy nuance

`planning/PERMISSIONS.md` uses "optional" wording for Assistant Coach on some operational capabilities. Current code is narrower: `announcement.publish`, `fillin.manage` and `training.manage` are granted to Head Coach/Admin/Manager, not Assistant Coach.

That divergence must be resolved explicitly, not by opportunistic implementation.

---

# Epic map

| Epic | Outcome |
|---|---|
| AC-E1 Team access | Assistant enters only assigned active team(s). |
| AC-E2 Game readiness | Assistant sees basketball context needed to support Head Coach. |
| AC-E3 Coaching capture | Assistant can capture/correct M4 data. |
| AC-E4 Review/privacy | Assistant can contribute to review/private notes. |
| AC-E5 Practice planning | Assistant can collaborate on practice plan. |
| AC-E6 Revocation | Access disappears immediately when assignment ends. |

---

# AC-E1 — Team-scoped access

## Story

As an Assistant Coach, I want my access automatically scoped to my assigned active team so that I cannot accidentally view or change another team's coaching information.

**Acceptance**
- active team membership required;
- exact team enforced by capability + RLS;
- inactive team denies;
- revoked membership denies;
- Club Admin role elsewhere does not widen coaching scope;
- Guardian dual-role does not widen coaching scope;
- team switch clears stale private data.

**Current:** **IMPLEMENTED strongly** in authorization; **PARTIAL UX** due no role home/team switcher.

---

# AC-E2 — Game readiness

## Journey

```text
Assistant Coach Home
 -> assigned team
 -> next game
 -> roster
 -> availability
 -> game details
 -> coach focus
```

**Current:** **PARTIAL**.

The facts/projections exist. A dedicated coach-role landing experience does not.

## Remediation

Reuse the same future `coach_home_projection` as Head Coach. Do not duplicate a second dashboard merely because the role name differs.

SOC should be expressed through capability-driven actions.

---

# AC-E3 — Coaching stats

## Story

As an Assistant Coach, I want to record/correct player stats when supporting the Head Coach so that data capture does not depend on one person.

**Current:** **IMPLEMENTED** web/domain/DB.

Assistant Coach is included explicitly in M4 security rules and database tests.

### Concurrency requirement

Private-note and correction paths must retain current transactional/stale-write safeguards when two coaches work concurrently.

---

# AC-E4 — Review and private notes

## Story

As an Assistant Coach, I want to contribute to the team review and private development notes while those notes remain inaccessible to managers, guardians and Club Admin-only users.

**Current:** **IMPLEMENTED/security strong**.

### Negative acceptance
- other team denied;
- revoked coach denied;
- Team Manager denied;
- Guardian denied;
- Club Admin-only denied.

---

# AC-E5 — Practice planning

## Story

As an Assistant Coach, I want to update the assigned team's practice plan so that coaching collaboration is not dependent on the Head Coach being the only editor.

**Current:** **IMPLEMENTED** via M4 capability.

## Channel gap

No phone-native practice editor. Recommendation: responsive web/tablet remains primary during pilot.

---

# AC-E6 — Revocation

## Story

As the club, when an Assistant Coach assignment is revoked, I want the next authoritative request denied even if the person's auth session is still active.

**Current:** **IMPLEMENTED by design/test**.

## Missing evidence

Hosted staging session-revocation smoke should be performed.

---

# Gap — ambiguous operational privileges

## Finding

Planning has optional Assistant Coach privileges; code chose a narrower policy.

### Risk
A future implementation agent may interpret "optional" as permission to grant access without product approval.

### RCA
Planning intentionally deferred the decision, but implementation selected a default and docs were not normalized afterward.

### Recommended pilot policy
Assistant Coach:
- M4 coaching set;
- coach check-in;
- read common team operations.

Do not grant Manager-like announcement/fill-in/training management unless a real pilot need is approved.

### Remediation
- update `PERMISSIONS.md`;
- update role story;
- keep capability tests as contract;
- treat future expansion as product/security change.

---

# Assistant Coach critical journey

```text
1. authenticate
2. choose assigned team
3. see Coach Home
4. view full roster / availability
5. record stat
6. update review
7. save private note
8. contribute to practice plan
9. attempt Manager-only duty management -> denied
10. attempt another team's coaching data -> denied
11. Admin revokes membership
12. next coaching request -> denied
```

---

# Remediation priority

## P0
- permission-doc normalization;
- coach role home/team switch;
- hosted revocation proof.

## P1
- relevant notification/deep-link UX.

## P2
- expand operational authority only from pilot evidence.

---

# Definition of Done — Assistant Coach pilot

The user experience communicates "you are a coach on this team", the M4 workflow is usable, and the role never silently inherits club/manager powers.
