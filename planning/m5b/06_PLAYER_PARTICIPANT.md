# Role Architecture — Player / Junior Participant

> **Audit baseline**
>
> Repository: `RajNori/stable`  
> PR: #3 — `milestone/5-pilot-hardening`  
> Current audited head: `5b8a7462a4b1d299421d6ed2c21e2a72ec714454`  
> Product / six-review SHA: `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb`
>
> Status labels: **IMPLEMENTED**, **PARTIAL**, **NOT IMPLEMENTED**, **DOMAIN ONLY**, **TARGET CHANGE**.


## Status of this role

A Player is **not an authenticated user in V1**. This is an intentional safeguarding and architecture decision.

The Player is a domain participant whose experience is mediated through authorized adults:
- Guardian;
- Head Coach;
- Assistant Coach;
- Team Manager;
- Club Admin where operationally required.

Do not create a player login merely to make the role matrix symmetrical.

---

# Player mission

From the child's perspective, The Stable should produce a simple outcome:

> I know where and when I need to show up, my team is organized, my coach remembers what we are working on, and my personal information is treated with respect.

---

# Separation of concerns

## Player data may support
- roster identity;
- team registration;
- attendance;
- game stats;
- recognition;
- coaching notes;
- practice focus;
- guardian relationships.

## Player data must not become
- public profile;
- unrestricted child search;
- direct adult-child chat;
- public leaderboard;
- analytics identity;
- push/log payload;
- unnecessary location history;
- production test data.

---

# Epic map

| Epic | Outcome |
|---|---|
| PL-E1 Identity/privacy | Junior identity is minimal and protected. |
| PL-E2 Team participation | Player is registered to the correct team. |
| PL-E3 Attendance | Guardian response accurately represents availability. |
| PL-E4 Game/coaching | Coaches can record appropriate basketball information. |
| PL-E5 Recognition | Positive behavior exists without public ranking. |
| PL-E6 Development privacy | Staff-private notes remain private. |

---

# PL-E1 — Minimal identity

## Story

As a junior player, I want only the identity information required to operate my team stored/displayed so that participation does not create unnecessary privacy exposure.

**Current:** **IMPLEMENTED strongly in architecture**.

Current principles:
- no public roster;
- default Guardian team display is first name + surname initial;
- full name available only where staff/admin operationally need it;
- no child name in analytics;
- no child name in stat-revision audit;
- DOB should not be collected unless eligibility rules truly require it.

---

# PL-E2 — Team registration

## Story

As a player, I want my active team registration to be correct so that schedule, attendance and coaching data attach to the right basketball context.

**Current:** **IMPLEMENTED**.

Strengths:
- player-team registration;
- team/club consistency;
- active registration constraints;
- roster projections;
- transfer-aware stats rule.

## Gap
Season rollover/history is not yet a mature product journey.

### Remediation before second season
- historical registration model/UX;
- archive semantics;
- current vs past roster;
- preserve game/stat history;
- no destructive "move" that rewrites historical context.

---

# PL-E3 — Attendance

## Story

As a player, I want my Guardian's latest RSVP to represent whether I can attend so that staff can plan accurately.

**Current:** domain/web **IMPLEMENTED**.

The practical mobile gap belongs to the Guardian role: native RSVP write is missing.

---

# PL-E4 — Game and coaching data

## Story

As a player, I want coaching statistics to remain simple, bounded and tied to actual games so that they support development without turning into an unhealthy ranking system.

**Current:** **IMPLEMENTED strongly**.

Safeguards include:
- numeric bounds;
- approximate-minutes bound;
- exact game/team relation;
- new line requires current registration;
- correction history restricted;
- provider-owned official result protection.

---

# PL-E5 — Recognition

## Story

As a player, I want positive behavior recognized without creating a public leaderboard.

**Current:** **IMPLEMENTED staff-facing**.

## Product boundary
Do not automatically expose recognition as player badges/leaderboards in pilot. Parent/player publication needs separate design/consent thinking and belongs with future development/achievement scope.

---

# PL-E6 — Staff-private development notes

## Story

As a junior player, I want sensitive coaching observations restricted to the coaching staff who need them so that private development feedback does not become club-wide data.

**Current:** **IMPLEMENTED/security strong**.

Current protections:
- exact-team active Head/Assistant Coach only;
- Club Admin-only denied;
- Team Manager denied;
- Guardian denied;
- no offline snapshot;
- no push;
- no analytics;
- no generic audit note text;
- M5 concurrent-write serialization.

---

# Player journey

```text
Admin creates/imports player
 -> guardian relationship
 -> team registration
 -> roster
 -> schedule
 -> guardian RSVP
 -> game
 -> coach stats
 -> coach review/private note
 -> practice focus
 -> next practice
```

The Player does not operate the application directly.

That is a deliberate feature.

---

# Gap analysis

## Immediate inherited gaps
- Guardian native RSVP/duty/fill-in;
- realistic staging;
- role-home surfaces;
- real push.

## Player-specific future gaps
- season rollover;
- gallery/photo consent;
- parent-visible own-child feedback;
- goals/challenges/achievements after safeguarding design.

---

# RCA — avoiding false remediation

A common architecture mistake would be to see "Player" in the domain and conclude a Player login is missing.

Adding child authentication now would create new:
- age/consent requirements;
- safeguarding concerns;
- identity recovery complexity;
- adult-child communication risk;
- privacy obligations.

Therefore no M5B remediation should introduce Player auth.

---

# Definition of Done — Player pilot

Player data is correct, minimal, team-scoped and privacy-safe; adult workflows support participation/coaching without requiring the child to authenticate.
