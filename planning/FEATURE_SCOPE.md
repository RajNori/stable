# Feature Scope and Acceptance Baseline

## MVP feature groups

### Foundation
- local/staging/production;
- Expo + web shells;
- design-token system;
- Supabase local;
- CI;
- observability.

### Identity and access
- Web: Google, Facebook, and email/password; recovery link for password reset.
- Mobile: SMS OTP primary and email magic-link alternative.
- Supabase Auth is the identity authority; players do not authenticate in V1.
- user profile;
- guardian relationship;
- team and club memberships;
- invitation lifecycle;
- capability evaluation.

### Club and team
- club;
- seasons;
- competitions;
- teams;
- venues;
- staff;
- roster.

### Fixtures and schedule
- manual fixture entry;
- import seam;
- official-field ownership metadata;
- schedule;
- eventual PlayHQ sync.

### Game Day
- critical event data;
- arrival/court/venue/uniform;
- attendance;
- duty;
- coach focus;
- offline snapshot.

### Training
- one-off/recurring;
- attendance;
- coach check-in;
- practice plan.

### Communications
- announcements;
- acknowledgements;
- push notifications.

### Operations
- manual duty assignment;
- automatic duty rotation preview;
- duty swap;
- fill-in workflow.

### Coaching
- manual score entry for Stable/manual games only (team/opponent 0–250); imported official results stay provider-owned;
- player stats with bounded whole-number values and restricted correction history;
- approximate court time with scheduled-duration validation or the 120-minute fallback;
- post-game team review, separate private player notes, MVP/recognition, typed review-to-practice focus and thin practice planner;
- All M4 coaching capabilities are for active Head and Assistant Coaches on the exact team; Club Admin authority alone, Team Managers, and Guardians receive no M4 coaching access. Existing non-M4 fixture/game projections retain their current access rules, including any final score they already expose.

### Club Admin
- operational dashboard;
- teams;
- people;
- roster;
- schedule;
- training;
- announcements;
- configuration.

## Deferred
See ATRD non-goals and Wave 2.

## M5B journey completion scope

M5B completes hosted pilot journeys on the existing architecture: server-side
role homes, Guardian mobile RSVP/duty/swap/fill-in/context/profile flows, full
Club Admin season/competition/venue/team lifecycle UX, the approved auth split,
guarded synthetic staging seed, and trusted push delivery. Keep provider-owned
fixture fields immutable and retain manual fixture entry when PlayHQ access is
not available. Do not introduce Player authentication, public/marketing web,
unrestricted chat, public child data, or production operations.
