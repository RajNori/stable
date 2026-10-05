# PLAN — The Stable

## Delivery strategy

Build **complete vertical slices**, not all backend first and all frontend later.

Parallel work is allowed only after the contract, capability and data ownership for a slice are agreed.

---

## Milestone 0 — Foundation

### Goals
Produce a reproducible repository that can deliver one trivial end-to-end vertical slice through mobile/web, auth, application boundary and Supabase.

### Work
- pnpm workspace;
- Turborepo;
- TypeScript strict mode;
- Node runtime pin;
- Expo app shell;
- Next.js admin shell;
- Supabase local project;
- migrations;
- generated DB types workflow;
- environment schema validation;
- ESLint/formatting;
- Vitest;
- React Native Testing Library;
- web component testing if selected;
- Playwright;
- Maestro scaffold;
- pgTAP/RLS tests;
- Sentry adapters;
- PostHog privacy-safe adapter;
- CI;
- EAS profiles: development/preview/production;
- Vercel preview/staging/production mapping;
- semantic design-token scaffold only;
- feature-flag mechanism if truly needed.

### Exit gate
A minimal authenticated "who am I / current club context" slice can be run and tested locally without production services.

---

## Milestone 1 — Identity, Tenancy and Roster

### Slice 1.1 Club/Season/Competition/Team/Venue
- schema;
- seed data;
- admin CRUD through explicit operations;
- tenant constraints;
- audit events.

### Slice 1.2 Adult authentication
- phone OTP;
- email OTP/magic link;
- Apple;
- Google;
- account linking strategy;
- session restoration;
- logout/token revocation behaviour.

### Slice 1.3 Player and guardian relationships
- create/import player;
- guardian link;
- multiple guardians;
- sibling support;
- conservative display-name rules.

### Slice 1.4 Membership/capabilities
- club admin;
- head coach;
- assistant coach;
- team manager;
- guardian relationship;
- multi-role user;
- membership revocation.

### Slice 1.5 Invitations
- guardian invite;
- coach/manager invite;
- expiration;
- one-time consumption;
- wrong identity handling;
- already-existing account.

### Slice 1.6 Roster
- guardian view;
- staff view;
- Club Admin view;
- privacy masking.

### Exit gate
Cross-team/club access tests all pass. Admin can create/manage teams and invite legitimate users. Guardian sees only permitted team/player data.

---

## Milestone 2 — Weekly Basketball Loop

### Slice 2.1 Fixture model
- manual entry;
- import contract;
- source metadata;
- official vs team-overlay fields;
- future PlayHQ mapping IDs.

### Slice 2.2 Schedule
- games;
- training;
- club event support if needed;
- chronological agenda;
- filtering.

### Slice 2.3 Game Day
- opponent;
- round;
- start;
- arrival;
- venue/court;
- uniform;
- coach note;
- own child RSVP;
- staff attendance summary;
- duty;
- cached offline snapshot.

### Slice 2.4 Attendance
- ATTENDING;
- UNAVAILABLE;
- UNSURE;
- UNANSWERED derived state;
- optional absence category;
- audit;
- reminders.

### Slice 2.5 Training
- one-off practice;
- recurring weekly series;
- edit one/this-and-future/series;
- coach assignment;
- attendance;
- coach check-in.

### Slice 2.6 Offline Game Day
- read-only critical snapshot;
- last-updated timestamp;
- stale indicator;
- reconnect refresh;
- safe handling of queued/non-queued actions.

### Exit gate
A real family can complete Friday/Saturday and Tuesday training workflows without external spreadsheets for team-level data.

---

## Milestone 3 — Communication and Operations

### Slice 3.1 Announcements
- categories;
- importance;
- optional acknowledgement;
- read/ack state;
- manager visibility.

### Slice 3.2 Notifications
- device registration;
- multiple devices;
- preference model;
- event-driven messages;
- retry;
- invalid token cleanup;
- delivery log.

### Slice 3.3 Duties
- manual assignment;
- acknowledge;
- fair automatic rotation preview;
- commit automatic allocation;
- history.

### Slice 3.4 Duty swap
- open request;
- targeted request optionally;
- atomic acceptance;
- race protection;
- notification.

### Slice 3.5 Fill-ins
- request;
- candidate eligibility abstraction;
- response;
- manager confirmation;
- Game Day update.

### Exit gate
Team manager can operate the weekend without WhatsApp for core operational coordination.

---

## Milestone 4 — Coaching Loop (MVP)

### Slice 4.1 Game score and player stats
- final score;
- points;
- rebounds;
- assists;
- steals;
- fouls;
- approximate minutes;
- validation;
- correction history where appropriate.

### Slice 4.2 Post-game review
- team notes;
- private player notes;
- MVP/Player of Game;
- recognition categories;
- development focus tags;
- next-practice focus creation.

### Slice 4.3 Thin practice planner
- plan attached to training;
- timed blocks;
- drill name/instructions;
- reorder;
- duplicate previous;
- template;
- notes;
- total duration validation;
- carry review focus into practice.

### Exit gate
Coach can move from game observations to a useful next training plan entirely inside The Stable.

---

## Milestone 5 — Pilot Hardening

- full critical E2E;
- performance baseline;
- accessibility review;
- offline failure tests;
- auth recovery tests;
- backup/restore drill for staging;
- Sentry verification;
- privacy review;
- audit review;
- production configuration checklist;
- TestFlight + Android internal release;
- pilot seed/configuration.

### Pilot release gates
See `RELEASE.md`.

---

## Wave 2

- private photo gallery;
- parental photo consent;
- player goals;
- challenges;
- achievements;
- parent-visible own-child feedback;
- season recap.

---

## Parallelisation map

### Can run in parallel after contracts freeze
- Mobile shell ↔ Web shell ↔ CI setup.
- Fixture UI ↔ fixture domain ↔ DB migration after fixture contract.
- Announcement UI ↔ notification infrastructure after event contract.
- Coach stats UI ↔ stats domain ↔ DB after stats contract.

### Must remain ordered
- tenancy schema before RLS;
- capability matrix before staff UI assumptions;
- fixture ownership model before PlayHQ sync;
- event series rules before recurring-training UI;
- notification event definitions before push templates;
- design system before production visual styling.

---

## Integration checkpoints

At the end of every milestone:
1. Integrator rebases/merges isolated branches.
2. Full gate runs.
3. QA performs acceptance/abuse journeys.
4. Security reviewer checks changed trust boundaries.
5. Human reviews unresolved trade-offs.
6. Only then begin the next milestone.
