# The Stable — Implementation Architecture, Traceability, Gap Analysis & RCA

> **Audit baseline**
>
> Repository: `RajNori/stable`  
> PR: #3 — `milestone/5-pilot-hardening`  
> Current audited head: `5b8a7462a4b1d299421d6ed2c21e2a72ec714454`  
> Product / six-review SHA: `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb`
>
> Status labels:
> **IMPLEMENTED**, **PARTIAL**, **NOT IMPLEMENTED**, **DOMAIN ONLY**, **TARGET CHANGE**.
>
> These are implementation-architecture documents. Where the current code and the newly agreed product experience differ, the difference is treated as an explicit implementation gap.


## Executive assessment

The repository is architecturally stronger than the current product experience suggests. The domain, RLS, migrations, authorization, offline boundary and automated-test depth are mature. The principal risk has shifted from basic code correctness to **product-journey completeness and real hosted-system verification**.

Recorded strengths include vertical-slice packages across the main domains, contextual authorization, extensive RLS, 23 pgTAP files / 917 assertions, 24 authenticated Playwright journeys, 6 unauthenticated browser tests, 127 web tests, 157 mobile tests, offline Game Day hardening, child-privacy constraints and six independent M5 reviews.

The critical weaknesses are:

1. hosted Supabase staging is not yet the permanent human acceptance environment;
2. the auth contract changed after the identity slice froze;
3. web and mobile home surfaces are engineering shells rather than role-operational dashboards;
4. the parent mobile journey is read-heavy while the real workflow is action-heavy;
5. push notification domain logic exists without real device-token acquisition and provider delivery;
6. hosted staging has no persistent realistic pilot seed;
7. high code coverage proves written code but cannot expose missing journeys;
8. PlayHQ is still a seam rather than live integration;
9. Sentry is not initialized/receipt-tested;
10. store-release work began before cloud-product acceptance was complete.

The correct response is **not a rewrite**. Preserve the domain/RLS architecture and run a journey-completion programme over it.

---

## Current runtime topology

The intended runtime remains sound:

```text
Expo iOS / Android
        |
        | RLS-safe reads + explicit commands
        v
      Supabase
        |
        v
     Postgres

Next.js / Vercel
        |
        | Supabase SSR/browser session
        | RLS-safe reads + explicit commands
        v
      Supabase
```

External boundaries:
- PlayHQ integration adapter
- Expo Push -> APNs/FCM
- Sentry
- PostHog

### Keep local Supabase

Local Supabase remains the deterministic environment for migrations, pgTAP, destructive RLS tests, concurrency tests, CI and disposable E2E setup.

### Change the human-facing development topology

```text
Local Next.js  --------\
Vercel Preview ---------\
iOS dev client ----------> one hosted staging Supabase project
Android emulator --------/
EAS Preview -------------/
```

This is the missing bridge between "the test harness passes" and "the real hosted product behaves like a user experiences it".

---

## Implementation inventory

### Web surfaces

- `/`
- `/club-structure`
- `/players`
- `/notifications`
- `/invitations/accept`
- `/teams/[teamId]/staff`
- `/teams/[teamId]/roster`
- `/teams/[teamId]/fixtures`
- `/teams/[teamId]/schedule`
- `/teams/[teamId]/training`
- `/teams/[teamId]/announcements`
- `/teams/[teamId]/games/[eventId]`

### Mobile surfaces

Tabs:
- Home
- Schedule
- Team
- Updates
- Profile

Implemented content:
- auth/session gate
- current club/team context
- schedule
- Game Day read projection
- offline Game Day
- roster
- announcements/read/ack
- manual device-token registration

`Profile` is a placeholder.

### Feature packages

announcements, attendance, club-structure, coaching-review, current-club-context, fill-ins, fixtures, game-day, invitations, membership, notifications, players, practice-planner, roster, schedule, training.

---

## Cross-role scorecard

| Product area | Domain/DB | Web | Mobile | Real cloud proof | Overall |
|---|---:|---:|---:|---:|---|
| Tenancy/capabilities | Strong | Strong | Strong | Partial | PARTIAL |
| Club/season/team | Strong | Partial | N/A | No | PARTIAL |
| Competition/venue | Strong | Missing admin UX | N/A | No | DOMAIN ONLY |
| Player management | Strong | Strong | Roster read | Local | PARTIAL |
| Guardian/invites | Strong | Strong | Not productized | Local | PARTIAL |
| Staff assignment | Strong | Strong | N/A | Local | IMPLEMENTED web |
| Web auth target | Old OTP/OAuth base | Wrong target | N/A | No | TARGET CHANGE |
| Mobile auth target | Strong OTP/session | N/A | Partial | No hosted proof | PARTIAL |
| Fixtures | Strong | Strong manual | Read | Local | PARTIAL |
| PlayHQ | Seam | No live sync | No live sync | No | NOT IMPLEMENTED |
| Schedule | Strong | Read | Read | Local | PARTIAL |
| Guardian RSVP | Strong | Implemented | Missing native write | Local web E2E | PARTIAL |
| Training | Strong | Create/series/check-in | Schedule only | Local | PARTIAL |
| Announcements | Strong | Publish/read/ack | Read/ack | Local | PARTIAL |
| Push | DB/domain | prefs/token forms | manual token | No real provider | PARTIAL |
| Duties | Strong | Manage/respond/swap | display only | Local | PARTIAL |
| Fill-ins | Strong | Manage/respond/confirm | display only | Local | PARTIAL |
| Coaching | Strong | Strong | no coaching workflow | Local | PARTIAL |
| Practice planner | Strong | Strong | Missing | Local | PARTIAL |
| Offline Game Day | Strong | N/A | Strong read-only | local only | PARTIAL |
| Role dashboards | data exists | placeholder | technical context home | No | NOT IMPLEMENTED |
| Observability | scrubber/helper | SDK dep only | SDK dep only | No | PARTIAL |

---

# Systemic gaps and RCA

## GAP-01 — Hosted staging is not the primary acceptance environment
**Priority:** P0  
**Category:** Architecture / environment

### Impact
Unproven real boundaries include hosted Auth, Twilio, SendGrid, HTTPS callbacks, deep links, hosted migration parity, hosted RLS parity, real network behavior, EAS environment mapping, backups and runtime observability.

### Root cause
Early milestones correctly optimized for reproducible local safety. Hosted-system verification was deferred until release hardening.

### Why tests did not catch it
CI intentionally refuses hosted credentials and URLs. Green CI proves local correctness, not cloud configuration.

### Why coverage did not catch it
Environment topology has no missing line to mark uncovered.

### Remediation
- designate `stable-staging`;
- record staging vs production refs;
- apply reviewed migrations;
- point local web, Vercel Preview, local Expo/dev client and EAS Preview at staging;
- add guarded idempotent pilot seed;
- run role-based hosted smoke journeys;
- keep CI local.

---

## GAP-02 — Authentication contract drift
**Priority:** P0  
**Category:** Product / planning / implementation

Original baseline: phone OTP, email OTP/magic link, Apple, Google.

Approved target:

**Dashboard**
- Google
- Facebook
- email/password
- password recovery link

**Mobile**
- SMS OTP default
- email magic-link alternative

Current code has phone/email OTP, magic-link primitives, disabled Google/Apple adapters, no Facebook, no email/password dashboard and no password-reset dashboard.

### Root cause
One shared provider matrix was treated as both the web and mobile product requirement.

### Implementation consequence
Good reusable auth code now implements the wrong channel experience.

### Coverage consequence
High auth coverage reinforces the old contract; it does not prove the new one.

### Remediation
Freeze a new auth ADR covering platform credential strategies, linking, invitation matching, recovery and lost/changed phone before refactoring UI/adapters.

---

## GAP-03 — Dashboard is an engineering shell, not an operational dashboard
**Priority:** P0/P1

Current authenticated home emphasizes club context and capability strings. "Overview" and "Needs attention" are largely shell content.

### Root cause
Feature slices reached Done independently, but dashboard aggregation never became a first-class slice.

### Why coverage missed it
Individual pages can be fully tested while the landing experience remains weak.

### Remediation
Create a `role-home` vertical slice with server projections for actionable aggregates:
- next event
- unresolved RSVPs
- open duty
- expiring invitation
- missing staff
- open fill-in
- unacknowledged announcement
- training exception
- coach review due where safe

No private note content.

---

## GAP-04 — Mobile is read-heavy; Guardian workflow is action-heavy
**Priority:** P0

Mobile currently has context, schedule, roster, announcements and Game Day/offline read. Missing parent-critical native actions include:
- RSVP write
- duty acknowledge/swap
- fill-in response
- richer training participation
- profile/account
- polished invitation acceptance
- deliberate context switching

### Root cause
M2/M3 domain and web command surfaces completed before a full Friday-to-Saturday Guardian mobile journey became the acceptance spine.

### Coverage lesson
157 mobile tests prove a well-tested partial mobile product.

### Remediation
Complete the Guardian mobile loop one existing domain operation at a time.

---

## GAP-05 — Push notifications are not a real push system
**Priority:** P0/P1

Present:
- device endpoints
- preferences
- delivery decisions
- invalid-token logic
- fake Expo push port

Missing:
- `expo-notifications` permission/token acquisition
- production UX
- real push provider adapter
- trusted dispatcher/worker
- receipt handling
- physical-device proof

The manual device-token field is a diagnostic interface.

### Root cause
Notification domain/provider separation was correct, but provider delivery was never completed.

### Remediation
Implement token lifecycle + trusted dispatcher + Expo Push + receipt/status updates + invalid-token cleanup + physical iOS/Android smoke.

---

## GAP-06 — No persistent realistic hosted pilot seed
**Priority:** P0

Current `seed.sql` creates only a minimal club/season/team. Rich data exists only inside disposable tests.

### Root cause
Seed design targeted test prerequisites, not product acceptance.

### Remediation
Create a guarded staging-only seed containing synthetic admin, coach, assistant, manager, guardians, 8–10 players, previous/upcoming games, RSVPs, duties, fill-in, announcements, training, stats/review and next-practice focus.

---

## GAP-07 — Club structure domain exceeds admin UX
**Priority:** P1

The domain supports seasons, competitions, venues, teams and update/deactivate operations. Visible admin UX mainly exposes seasons/teams plus a combined create form.

### Root cause
Proof-slice UI was never promoted into the complete admin surface.

### Remediation
Separate season, competition, venue and team lifecycle slices.

---

## GAP-08 — PlayHQ is still an integration seam
**Priority:** P1 / post-pilot depending API access

This is deliberate deferred scope, not a code-quality defect. Preserve manual source ownership until API access is available.

---

## GAP-09 — Sentry is not runtime-connected
**Priority:** P1 pilot operations

The scrubber is good and intentionally privacy-conservative. Destination approval and real staging receipt remain missing.

---

## GAP-10 — Release sequencing ran ahead of product acceptance
**Priority:** process

Store-build planning began before hosted auth, realistic seed, push and parent mobile command journeys were proven.

### Prevention
Future milestone exit must include role-journey traceability and hosted staging demonstration before store-release ceremony.

---

# Code coverage RCA

Coverage is not the failure.

Recorded candidate:
- web about 98.18% lines / 92.81% branches;
- mobile about 95.14% lines / 92.67% branches;
- extensive pgTAP.

Coverage asks: **how much of written code ran?**

It does not ask: **did we write every story the user needs?**

Examples:
- no native RSVP code -> no uncovered RSVP line;
- no real push adapter -> no uncovered push adapter line;
- no password-reset dashboard -> no uncovered reset code;
- no competition admin page -> web coverage can remain excellent.

## Process remediation: requirements coverage

Every release story must trace:

```text
Story ID
 -> capability
 -> UI entry point
 -> application/domain operation
 -> RLS/SQL enforcement
 -> automated acceptance evidence
 -> hosted smoke evidence where external infrastructure matters
```

No complete chain = incomplete story.

---

# Target SOC

## Club Admin
Governance, structure, people, staff, invitations, operational oversight, safe audit. No coach-private content solely through admin role.

## Head Coach
Basketball loop: availability, game context, score/stats, review, private notes, recognition, practice.

## Assistant Coach
M4 coaching collaborator on exact assigned team. No implied admin/manager authority.

## Team Manager
Weekly logistics: fixtures, roster operations, training ops, announcements, duties, swaps, fill-ins.

## Guardian
Own-child logistics: schedule, RSVP, announcements, own duty, fill-in response, offline Game Day.

## Player
No authentication in V1. Privacy-safe participant record.

---

# Remediation programme

## Phase A — Contract reset
- adopt these role stories;
- ADRs for web auth, mobile auth, hosted staging, real push, role-home;
- update ATRD / FEATURE_SCOPE / AUTH / TESTING / RELEASE.

## Phase B — Cloud staging
- one hosted staging project;
- migrations;
- Twilio;
- SendGrid;
- exact redirects/deep links;
- realistic guarded seed;
- Vercel/local Expo -> staging.

## Phase C — Role home/navigation
- Club Admin home
- Team Manager home
- Coach home
- Guardian mobile Home
- role/team context switching

## Phase D — Complete Guardian mobile loop
- RSVP
- duty acknowledge/swap
- fill-in response
- training detail
- profile/recovery
- invitation/deep-link polish

## Phase E — Real notifications
- permission/token acquisition
- trusted push adapter
- delivery worker
- receipts
- device E2E

## Phase F — Auth target
Web: Google, Facebook, email/password, recovery.  
Mobile: SMS OTP default, email magic-link alternative.

## Phase G — External operations
Sentry, backups, physical accessibility, operator rehearsal.

## Phase H — Distribution
Only then create the serious TestFlight and Play Internal candidates.

---

# Definition of architectural Done

A role-critical story is not pilot-ready until it has:
- actor/value
- SOC
- capability
- tenant/team context
- data ownership
- complete UI journey
- loading/empty/error/recovery
- application operation
- RLS/DB enforcement where relevant
- privacy review
- automated acceptance
- hosted smoke for external behavior
- accessibility evidence
- audit/observability as needed

---

# Recommended next milestone

## M5B — Cloud Pilot Journey Completion

This is not feature expansion. It is the missing integration layer.

Exit:
1. realistic hosted staging seed;
2. target auth working;
3. role homes usable;
4. Guardian critical mobile actions complete;
5. real push proven;
6. cross-role hosted smoke suite passes;
7. existing DB/security/code coverage stays green;
8. TestFlight/Play become final distribution validation rather than feature testing.
