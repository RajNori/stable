# Role Architecture — Parent / Guardian

> **Audit baseline**
>
> Repository: `RajNori/stable`  
> PR: #3 — `milestone/5-pilot-hardening`  
> Current audited head: `5b8a7462a4b1d299421d6ed2c21e2a72ec714454`  
> Product / six-review SHA: `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb`
>
> Status labels: **IMPLEMENTED**, **PARTIAL**, **NOT IMPLEMENTED**, **DOMAIN ONLY**, **TARGET CHANGE**.


## Role mission

The Guardian is the primary mobile consumer.

The app should answer within ten seconds:

> What is next for my child, and do I need to do anything?

Parents manage logistics. Coaches manage basketball.

## Separation of concerns

### Guardian may
- authenticate as an adult;
- access actively managed child/team context;
- see masked team roster;
- see schedule/Game Day;
- RSVP for managed player;
- read/ack announcements;
- see/respond to own duties;
- request/accept permitted swaps;
- respond for eligible fill-in player;
- use authorized offline Game Day snapshot.

### Guardian may not
- manage unrelated players;
- see unnecessary full child identities;
- see team-wide private absence detail;
- access M4 coaching stats;
- access post-game review;
- access private player notes;
- access practice plan;
- gain authority from matching surname/email/phone alone.

---

# Epic map

| Epic | Outcome |
|---|---|
| PG-E1 Mobile auth | Parent gets into app quickly. |
| PG-E2 Context | Correct child/team is obvious. |
| PG-E3 Home | Parent immediately sees next action. |
| PG-E4 Schedule | Games/training are understandable. |
| PG-E5 Game Day/RSVP | Parent can prepare and respond. |
| PG-E6 Roster | Parent recognizes teammates safely. |
| PG-E7 Announcements | Team communication is authoritative. |
| PG-E8 Duties | Parent can acknowledge/resolve conflicts. |
| PG-E9 Fill-ins | Parent can respond for eligible player. |
| PG-E10 Offline | Critical Game Day survives poor reception. |
| PG-E11 Profile/recovery | Adult can manage account/session/preferences. |

---

# PG-E1 — Mobile authentication

## Approved target journey

```text
Launch
 -> Mobile selected by default
 -> enter Australian mobile
 -> normalize +614...
 -> Supabase Auth
 -> Twilio SMS OTP
 -> enter 6-digit code
 -> authenticated session
 -> SecureStore
 -> Home
```

Alternative:

```text
Use email instead
 -> enter email
 -> Supabase Auth
 -> SendGrid magic link
 -> tap link
 -> stable://auth/callback
 -> app completes session
 -> Home
```

## Current state: **PARTIAL**

### Strong
- AU mobile normalization;
- phone OTP request/verify;
- six-digit UI;
- resend/error handling;
- chunked SecureStore;
- session restore/refresh/logout;
- callback race hardening;
- account-switch cache cleanup;
- extensive accessibility and auth tests.

### Target differences
- current email route is six-digit email OTP, while target is a cleaner magic-link alternative;
- Twilio hosted delivery not proven;
- SendGrid hosted delivery not proven;
- real-device deep-link callback not proven.

## RCA
Engineering is strong; provider UX was not frozen early enough.

---

# PG-E2 — Child/team context

## Current

**PARTIAL**.

Current context screen shows:
- club;
- display name;
- active team;
- available teams;
- managed-player count;
- capabilities.

This is technically useful but not a parent-grade context switch.

## PG-CTX-01 — Context switch

As a Guardian with multiple children/teams, I want to switch the active child/team clearly so that all subsequent screens are in the right context.

**Acceptance**
- only active managed children/teams;
- current context always visible;
- switch invalidates relevant queries;
- offline pointer cannot cross team/user;
- dual-role adult can enter a staff context explicitly.

---

# PG-E3 — Parent Home

## Current: **NOT IMPLEMENTED as intended product experience**

The current Home is a technical club-context view.

## Target

```text
The Stable

U14 Boys
Next game: Saturday 10:30
Arrive: 10:00
Court 2

RSVP: Not answered        [Respond]
Your duty: Scorer         [View]

Training: Tue 6:00 PM

Latest update:
Venue changed
```

## PG-HOME-01

As a Guardian, I want the next event and outstanding actions immediately visible so that I do not have to navigate around the app to understand the week.

## Architecture
Build a guardian-safe Home projection. Do not expose unrelated child names or private staff data.

---

# PG-E4 — Schedule

## Story

As a Guardian, I want games and training in chronological order so that family logistics are easy to plan.

**Current:** **IMPLEMENTED read** with empty/error states.

## Gaps
- multi-team context;
- richer event detail;
- training-specific detail/action;
- hosted real-data proof.

---

# PG-E5 — Game Day and RSVP

## Current Game Day read: **IMPLEMENTED strongly**

Mobile supports:
- opponent/round;
- own RSVP projection;
- own duty;
- fill-in state;
- safe availability summary;
- offline snapshot;
- stale/reconnect safeguards.

## RSVP implementation status

The native managed-player RSVP action is implemented locally in the Game Day
screen (`b311840`). It lists only the authenticated Guardian's eligible,
registered managed players and submits through the existing
`recordAttendance` command and caller-authenticated gateway. The action is
online-only, waits for the current Game Day refresh, does not queue offline
writes, and sends no Guardian absence note/category. Mobile screen, domain,
gateway and pgTAP coverage exists. Native hosted and physical iPhone acceptance
are still required; local implementation does not close the P0 story.

## PG-RSVP-01

As a Guardian, I want to mark my managed child Attending, Unavailable or Unsure directly from the mobile Game Day screen.

**Acceptance**
- managed player only;
- exact event/team;
- online authoritative command;
- responder attribution;
- no offline queue;
- reconnect requires successful authoritative refresh before write;
- safe conflict/error handling;
- optional absence information remains private.

**Priority:** **P0**.

---

# PG-E6 — Team roster

## Story

As a Guardian, I want to recognize teammates while seeing only privacy-safe names.

**Current:** **IMPLEMENTED**.

The masked roster model and denial tests are strong.

The web `/players` route is club-staff player administration, not the
Guardian roster experience. A Guardian who opens it is denied the player
administration projection and directed to Home; Home asks the Guardian to
choose one of their authorized team contexts before showing the Guardian
projection. The authorized masked team roster remains a separate team-scoped
surface. Do not broaden `/players` to return managed-player or club roster
records.

---

# PG-E7 — Announcements

## Current

**IMPLEMENTED mobile read / mark read / acknowledge**.

## UX defect

The mobile Updates screen also asks the user to type a **Device token** and manually Register/Remove it.

That is diagnostic infrastructure, not parent UX.

## PG-PUSH-01

As a Guardian, I want notification permission and device registration handled as a normal mobile capability so that I never need to know what a push token is.

**Remediation**
- `expo-notifications`;
- permission UX;
- retrieve Expo token;
- auto-register;
- refresh/invalid-token lifecycle;
- notification preferences in Profile;
- deep link to relevant event/update.

---

# PG-E8 — Duties

## Current domain/web
- assignment;
- acknowledgement;
- swap request;
- atomic acceptance.

## Native gap
Mobile Game Day displays duty but does not let Guardian complete core duty actions.

## Stories

### PG-DUTY-01 — Acknowledge
As a Guardian, I want to acknowledge my assigned duty from my phone so that the Manager knows I have seen it.

### PG-DUTY-02 — Request swap
As a Guardian who cannot perform my duty, I want to request a swap without leaving The Stable.

### PG-DUTY-03 — Accept swap
As an eligible adult, I want to accept an available swap once, with clear final ownership.

**Priority:** P0/P1.

---

# PG-E9 — Fill-ins

## Current
Web Game Day supports Guardian fill-in response. Mobile only displays fill-in status.

## PG-FILL-01

As a Guardian of an eligible player, I want to respond to a fill-in request from my phone so that the Manager knows whether my child is available.

**Acceptance**
- eligible managed player only;
- active guardian link;
- response is not manager confirmation;
- closed request is non-actionable;
- stale response safely rejected/refreshed;
- no double confirmation.

---

# PG-E10 — Offline Game Day

## Current: **IMPLEMENTED strongly**

This is one of the most complete mobile user stories:
- minimal snapshot;
- versioned locator;
- wrong-user/team fail closed;
- last updated;
- stale state;
- no mutation queue;
- authoritative reconnect;
- cache clear on logout/account switch.

## PG-OFF-01

As a Guardian in poor reception, I want the last authorized Game Day information even when the network is unavailable.

## Recommendation
Do not weaken this architecture to add offline RSVP. Read-only is the right pilot policy.

---

# PG-E11 — Profile and recovery

## Current

`Profile` is a placeholder.

## Pilot Profile scope

- adult display/contact metadata where appropriate;
- auth/recovery help;
- notification preferences;
- sign out;
- privacy/support links.

No child medical record or bloated account-management surface.

---

# Real push requirement

Domain support exists, but real push transport does not.

The Guardian use case makes this a genuine product gap because The Stable is intended to replace operational chat for:
- fixture changes;
- RSVP reminders;
- training changes;
- announcements;
- duties;
- fill-ins.

Push may be best-effort technically; the product flow still has to exist.

---

# Current evidence mapped to Guardian

**Strong**
- mobile auth/session tests;
- secure storage tests;
- offline tests;
- mobile schedule;
- mobile roster;
- mobile announcements;
- browser Guardian RSVP E2E;
- guardian invitation E2E;
- RLS matrices.

**Missing/partial**
- hosted Twilio/SendGrid;
- parent Home;
- context switch;
- native RSVP;
- native duties/swaps;
- native fill-in response;
- Profile;
- real push.

---

# RCA — why Guardian is the critical gap

### Root cause
Milestones prioritized high-risk domain/RLS/offline correctness and used web as the easiest complete mutation surface.

### Why that was reasonable
The team solved the dangerous problems first: child leakage, wrong-team access, auth races, stale offline data, concurrency.

### Why it is now a blocker
The highest-volume real user is on mobile. A safe backend with web-only parent commands is still not the intended product.

### Coverage lesson
157 mobile tests are evidence of high quality **within implemented mobile scope**, not complete mobile product scope.

---

# Guardian hosted acceptance journey

```text
1. run staging dev client
2. SMS OTP through Twilio
3. land on realistic Home
4. switch permitted child/team context
5. open next Game Day
6. save RSVP
7. read/ack announcement
8. receive real push
9. acknowledge duty
10. request/accept swap as applicable
11. respond to fill-in
12. lose network
13. reopen cached Game Day
14. see stale/read-only state
15. reconnect and authoritative refresh
16. sign out
17. verify private/offline cache cleared
```

---

# Remediation priorities

## P0
- hosted SMS;
- realistic staging seed;
- parent Home;
- context switch;
- mobile RSVP.

## P1
- duties/swaps;
- fill-in response;
- real push;
- Profile;
- email magic-link alternative.

## P2
- calendar integrations and richer preferences.

---

# Definition of Done — Guardian pilot

A parent can handle a normal basketball week entirely from the phone. If a core V1 response requires the web dashboard or WhatsApp, the Guardian journey is not Done.
