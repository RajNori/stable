# Role Architecture — Club Admin

> **Audit baseline**
>
> Repository: `RajNori/stable`  
> PR: #3 — `milestone/5-pilot-hardening`  
> Current audited head: `5b8a7462a4b1d299421d6ed2c21e2a72ec714454`  
> Product / six-review SHA: `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb`
>
> Status labels: **IMPLEMENTED**, **PARTIAL**, **NOT IMPLEMENTED**, **DOMAIN ONLY**, **TARGET CHANGE**.


## Role mission

The Club Admin is the **club governance and configuration owner**. The role makes teams operational, assigns the correct adults, manages player/guardian administration, maintains club structure, sees club-level exceptions and can review appropriate audit evidence.

The role must never become a backdoor into staff-private coaching data.

## Separation of concerns

### Owns
- club structure;
- seasons;
- competitions;
- teams;
- venues;
- player/person administration;
- guardian relationships;
- staff assignment/revocation;
- invitations;
- roster governance;
- club operational oversight;
- club-safe audit visibility.

### May participate in where explicitly authorized
- fixtures;
- training;
- announcements;
- duties/fill-ins.

### Explicitly does not gain merely from Club Admin
- coaching stats;
- post-game reviews;
- private player notes;
- recognition;
- practice plans.

If the same adult is also an active Coach, coaching access comes through that team membership.

---

# Epic map

| Epic | Outcome |
|---|---|
| CA-E1 Account access | Admin can securely return to the dashboard and recover access. |
| CA-E2 Club structure | Club hierarchy is correct and maintainable. |
| CA-E3 People and players | Adult/player records are useful without over-collecting child data. |
| CA-E4 Staff and invitations | Correct people receive correct scoped authority. |
| CA-E5 Roster governance | Team registration can be corrected safely. |
| CA-E6 Operational dashboard | Admin sees exceptions instead of hunting through pages. |
| CA-E7 Audit and security | Important changes are attributable without exposing coaching-private content. |

---

# CA-E1 — Dashboard account access

## Target user journey

```text
Dashboard
 -> Sign in
    -> Google
    -> Facebook
    -> Email + password
 -> Supabase Auth
 -> active membership resolution
 -> Club Admin Home
```

Recovery:

```text
Forgot password
 -> enter email
 -> neutral response
 -> SendGrid recovery email
 -> single-use recovery link
 -> restricted recovery session
 -> set new password
 -> normal session
 -> dashboard
```

## CA-AUTH-01 — Social sign-in

**User story**  
As a Club Admin, I want to sign in with Google or Facebook so that I can return to the dashboard without requesting a one-time login link each time.

**Acceptance criteria**
- provider authentication resolves to one Supabase adult identity;
- authentication alone creates no club role;
- active `CLUB_ADMIN` membership is evaluated after authentication;
- no membership returns a safe "No active club access" state;
- provider tokens are never logged or placed in analytics;
- provider identity collision follows a documented account-link policy;
- revoked Club Admin membership denies the next authoritative request.

**Current state:** **NOT IMPLEMENTED target**.
- Google OAuth abstractions exist but are frozen disabled.
- Facebook is not in the current provider implementation.

## CA-AUTH-02 — Email/password

**User story**  
As a Club Admin, I want to sign in with my email and password so that normal dashboard access does not require a one-time link.

**Acceptance criteria**
- password handled only by Supabase Auth;
- application never stores/replays password;
- secure supported web session persistence;
- neutral errors for invalid credentials;
- successful auth still requires active authorization context;
- rate-limit/brute-force protection is configured at the provider boundary.

**Current state:** **NOT IMPLEMENTED**.

## CA-AUTH-03 — Password recovery

**User story**  
As an email/password dashboard user who has forgotten my password, I want a secure one-time recovery link so that I can set a new password and regain access.

**Acceptance criteria**
- reset request does not disclose account existence;
- recovery link is short-lived and one-time;
- recovery state cannot be reused as normal session indefinitely;
- user sets a new password before completing the flow;
- previous reset link reuse is rejected;
- normal membership/RLS still governs dashboard data.

**Current state:** **NOT IMPLEMENTED target**.

## RCA

The original identity slice used a shared passwordless provider strategy for both web and mobile. The staff dashboard now has a materially different UX requirement. The implementation is good against the old contract; the contract itself changed.

**Category:** planning/product-contract drift, not poor code coverage.

## Remediation
1. Auth ADR separating dashboard and mobile credential strategies.
2. Implement email/password gateway and recovery.
3. Enable/configure Google.
4. Add Facebook adapter/configuration.
5. Rewrite web entry UI.
6. Reconcile invitation identity binding.
7. Hosted staging E2E before production/store work.

---

# CA-E2 — Club structure

## User journey

```text
Admin Home
 -> Club structure
 -> season
 -> competition
 -> team
 -> venue
 -> update/deactivate
 -> team operational surfaces
```

## CA-STRUCT-01 — Season lifecycle

**Story**  
As a Club Admin, I want to create, rename, activate and deactivate seasons so that current and historical team context stays correct.

**Current:** **PARTIAL**.
- application/domain supports create/update;
- DB/audit exists;
- current web UI exposes a combined "Create season and team" proof flow;
- Playwright verifies create season/team;
- complete lifecycle UX is absent.

**Remediation**
- season list/editor;
- active/inactive state;
- prevent unsafe deactivation when current teams depend on it unless policy defines expected effect;
- no destructive delete.

## CA-STRUCT-02 — Competition lifecycle

**Story**  
As a Club Admin, I want to create and maintain competitions within a season so that fixture/provider mappings have correct context.

**Current:** **DOMAIN ONLY**.
- contract/writer/DB support exists;
- admin screen does not expose it.

## CA-STRUCT-03 — Venue lifecycle

**Story**  
As a Club Admin, I want reusable venue/court records so that schedules do not depend on repeated free text.

**Current:** **DOMAIN ONLY**.

## CA-STRUCT-04 — Team lifecycle

**Story**  
As a Club Admin, I want to create, edit and deactivate teams and associate season/competition/venue context so that team ownership is explicit.

**Current:** **PARTIAL**.
Creation is exposed, but complete edit/deactivate/association journey is not.

## Implementable slice

`club-structure-admin-v2`

**Inputs**
- current club;
- seasons;
- competitions;
- venues;
- teams.

**Commands**
- create/update/deactivate each supported entity.

**Authorization**
- current active Club Admin;
- SQL/RLS/trusted RPC enforcement.

**Tests**
- same-club allow;
- wrong-club deny;
- revoked admin deny;
- invalid season/competition association;
- inactive dependency behavior;
- browser create/edit/deactivate.

---

# CA-E3 — People and player administration

## Journey

```text
People
 -> add/import player
 -> safe identity
 -> link guardian
 -> register team
 -> invite adult
 -> deactivate/reactivate if needed
```

## Stories

### CA-PEOPLE-01 — Create/import player
As a Club Admin, I want to create or safely import players so that teams can be populated without unnecessary child data.

**Current:** **IMPLEMENTED** on web/domain with E2E.

### CA-PEOPLE-02 — Guardian relationship
As a Club Admin, I want to link authorized guardians to a player so that the correct adults can manage that child's participation.

**Current:** **IMPLEMENTED domain/web**.

### CA-PEOPLE-03 — Privacy-safe identity
As a Club Admin, I want the system to display full child identity only where operationally required and masked identity elsewhere.

**Current:** **IMPLEMENTED strongly** through roster projections and policy.

### CA-PEOPLE-04 — Duplicate-safe administration
As a Club Admin, I want duplicate conflicts surfaced rather than silently merged so that child identities are not corrupted.

**Current:** **PARTIAL**. No mature operator duplicate-resolution journey.

**Remediation**
- define duplicate detection signals;
- never auto-merge on name;
- operator conflict state;
- audit resolution;
- future import tests.

---

# CA-E4 — Staff and invitations

## Journey

```text
Team
 -> Staff
 -> assign existing adult OR invite
 -> choose role
 -> adult authenticates
 -> identity constraint verified
 -> membership activated
 -> later revoke/reactivate
```

## CA-STAFF-01 — Assign/revoke staff

**Current:** **IMPLEMENTED**.
- Head Coach / Assistant Coach / Team Manager assignment;
- revoke/reactivate;
- audit;
- current membership facts used for authorization.

## CA-INV-01 — Identity-bound invitation

**Current:** **IMPLEMENTED against current identity model**.
- one-time;
- expiry/revocation;
- intended phone/email;
- replay denial;
- E2E identity binding.

### Target-change gap

New credential model requires a new identity-binding matrix.

Example:

| Invite constraint | Auth proof | Default result |
|---|---|---|
| intended phone | verified same SMS OTP phone | allow |
| intended email | verified same email/password identity | allow |
| intended email | Google/Facebook verified email | explicit policy required |
| intended phone | social/email only | deny until additional proof |
| none | not permitted for sensitive invite by default | deny/design decision |

Never match by display name or child surname.

### RCA
Invitation implementation is strong, but provider strategy changed after it froze.

---

# CA-E5 — Roster governance

## Story

As a Club Admin, I want to register/unregister players and see full operational roster identity so that team composition is accurate.

**Current:** **IMPLEMENTED**.

Strengths:
- full staff/admin projection;
- Guardian masked projection;
- cross-team denial;
- revoked access tests;
- Team Manager own-team management path.

## Gap

No "roster health" aggregation:
- player without guardian;
- player not registered;
- pending guardian invitation;
- inactive registration;
- team without staff.

## Remediation
Expose these as **Needs Attention**, not a new CRUD maze.

---

# CA-E6 — Operational dashboard

## Target journey

```text
Sign in
 -> Club Admin Home
    -> Needs attention
    -> teams
    -> people
    -> upcoming activity
    -> pending invitations
 -> one click to fix each issue
```

## Current state

**NOT IMPLEMENTED as a real dashboard**.

The current authenticated shell shows:
- current club;
- display name;
- capability strings;
- a static "Nothing needs attention" style panel.

## CA-HOME-01 — Needs Attention

As a Club Admin, I want actionable club exceptions on the landing page so that I know where intervention is needed.

Candidate safe items:
- team without Head Coach;
- team without Team Manager;
- expiring staff/guardian invitations;
- players missing guardian relationship;
- unresolved operational failures;
- open/unassigned duties;
- training without coach;
- stale fixture/import state;
- open fill-in requests.

**Privacy constraint:** no private coaching-note content and no unnecessary child detail.

## Architecture

Create a server-side `club_admin_home_projection`, not ten client queries. Projection returns counts, safe labels and action IDs/links.

---

# CA-E7 — Audit and security

## Story

As a Club Admin, I want appropriate operational audit history so that significant changes can be investigated without giving me access to staff-private coaching content.

**Current:** **PARTIAL**.
Audit exists and M5 tightened coaching audit visibility; a mature audit browser is not evident.

## Remediation
- paginated audit projection;
- category/date/action filter;
- opaque IDs where full child identity is unnecessary;
- no tokens;
- no private notes;
- retention documented;
- audit access itself covered by capability/RLS tests.

---

# Current evidence mapped to Club Admin

**Strong**
- `apps/web/e2e-auth/club-structure.spec.ts`
- `players.spec.ts`
- `roster.spec.ts`
- `invitations.spec.ts`
- `operations.spec.ts`
- current club-context integration
- M1 RLS suites

**Insufficient for target**
- hosted auth;
- social/password recovery;
- realistic staging;
- full structure UX;
- operational home;
- audit UX.

---

# Club Admin critical hosted journey

```text
1. sign in using target dashboard auth
2. active admin resolves
3. Admin Home shows real Needs Attention
4. create/activate season
5. create competition
6. create venue
7. create team
8. invite Head Coach and Team Manager
9. create/import synthetic players
10. link Guardian
11. register player
12. inspect roster
13. inspect pending invitation/audit
14. revoke staff
15. revoked user loses access on next request
16. Admin attempts private coaching note: denied unless independently a coach
```

---

# Remediation priority

## P0
- target web auth;
- hosted staging;
- realistic staging seed;
- real Admin Home;
- clean protected-route sign-in UX.

## P1
- competition/venue/team lifecycle UI;
- audit browser;
- invitation/provider identity matrix;
- role/team context switcher.

## P2
- bulk administration;
- season rollover tooling;
- reporting.

---

# Definition of Done — Club Admin pilot

- target dashboard auth works in hosted staging;
- active admin lands on an operational dashboard;
- no-membership state leaks no club data;
- club structure is fully manageable;
- staff invitation/revocation works;
- player/guardian/roster lifecycle works;
- cross-club/team denial remains green;
- admin-only role cannot access coach-private content;
- keyboard/accessibility smoke passes;
- hosted audit/telemetry contains no prohibited PII/auth material.
