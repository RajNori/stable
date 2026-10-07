# Risks and Edge Cases

## Identity
- same adult invited by phone and email;
- Apple private relay email;
- changed phone number;
- guardian with two children on different teams;
- guardian also coach;
- removed/re-added staff;
- invite accepted after role changed.

## Team/season
- player changes teams mid-season;
- team archived;
- season rollover;
- duplicated jersey numbers;
- coach changes.

## Fixtures
- manual fixture later matched to PlayHQ;
- upstream time changes after local arrival time set;
- postponed/cancelled;
- venue changes;
- duplicate external fixture;
- missing opponent/round;
- finals not known yet.

## Attendance
- guardian changes response near game;
- two guardians change same child;
- private absence note;
- RSVP cutoff if introduced later.

## Training recurrence
- cancel one instance;
- edit one;
- edit future;
- timezone/DST;
- venue changes for one occurrence;
- series ends early.

## Duties
- family has multiple children;
- user is also coach and should possibly be excluded;
- automatic allocator fairness;
- consecutive duties;
- swap accepted simultaneously by two users;
- assignee leaves team.

## Fill-ins
- eligibility unknown before PlayHQ/rule config;
- candidate already rostered;
- response accepted then unavailable;
- more responses than slots.

## Stats
- corrections after entry;
- approximate minutes exceed scheduled duration or the 120-minute fallback;
- stat entry is incomplete while the final score is known;
- player transfers after a stat line is recorded;
- score writes bypass M4 coaching capability through legacy fixture update;
- imported/provider-owned score is overwritten;
- recognition changes after review.

Frozen M4 decisions: Assistant Coaches receive the Head Coach M4 capability set; Team Managers receive none. New stat lines require current registration, but corrections to existing lines do not. Score writes use the coach-only M4 operation; the legacy metadata update preserves scores.

## Offline
- stale game time after fixture change;
- user logs out while snapshot exists;
- account switch;
- pending RSVP ambiguity.

## Notifications
- duplicate event;
- multiple devices;
- invalid token;
- membership revoked before asynchronous send;
- notification arrives after event changed.

## Admin
- Club Admin accidentally changes wrong team;
- bulk operations;
- destructive archive/delete;
- audit visibility.

Each applicable edge case must be addressed in slice acceptance criteria rather than kept only in this list.
