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
- minutes exceed game duration;
- stat entry incomplete;
- manager allowed/not allowed by team policy;
- recognition changed after review.

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
