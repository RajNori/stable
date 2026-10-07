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
- phone OTP;
- email OTP/magic link;
- Apple;
- Google;
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
- M4 capabilities for active Head and Assistant Coaches and Club Admins per the permission matrix; no M4 coaching access for Team Managers or Guardians; private notes require active team coaching membership.

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
