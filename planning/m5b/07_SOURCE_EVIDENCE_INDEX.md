# Source Evidence Index

## Audit anchor

- Repository: `RajNori/stable`
- PR: `#3`
- Current head: `5b8a7462a4b1d299421d6ed2c21e2a72ec714454`
- Product/six-review SHA: `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb`

## Planning contracts reviewed

- `planning/ATRD.md`
- `planning/PLAN.md`
- `planning/FEATURE_SCOPE.md`
- `planning/DOMAIN_MODEL.md`
- `planning/DATA_MODEL.md`
- `planning/ARCHITECTURE.md`
- `planning/PERMISSIONS.md`
- `planning/AUTH.md`
- `planning/CONTRACTS.md`
- `planning/SECURITY.md`
- `planning/OFFLINE.md`
- `planning/INTEGRATIONS.md`
- `planning/NOTIFICATIONS.md`
- `planning/TESTING.md`
- `planning/RELEASE.md`
- `planning/DEFINITION_OF_READY_DONE.md`
- `planning/RISKS_AND_EDGE_CASES.md`
- `planning/MILESTONE_5_RELEASE_EVIDENCE.md`
- `planning/MILESTONE_5_HUMAN_GATE_PACK.md`

## Web surfaces inspected

- `apps/web/app/page.tsx`
- `apps/web/components/club-admin-shell.tsx`
- `apps/web/components/club-sign-in.tsx`
- `apps/web/components/club-sign-in-live.tsx`
- `apps/web/app/auth/callback/route.ts`
- `apps/web/app/club-structure/page.tsx`
- `apps/web/components/club-structure-panel.tsx`
- `apps/web/app/players/page.tsx`
- `apps/web/app/teams/[teamId]/staff/page.tsx`
- `apps/web/app/teams/[teamId]/roster/page.tsx`
- `apps/web/app/teams/[teamId]/fixtures/page.tsx`
- `apps/web/app/teams/[teamId]/schedule/page.tsx`
- `apps/web/app/teams/[teamId]/training/page.tsx`
- `apps/web/app/teams/[teamId]/announcements/page.tsx`
- `apps/web/app/teams/[teamId]/games/[eventId]/page.tsx`
- corresponding panels/actions for roster, fixtures, Game Day, stats, post-game review, training, planner, announcements and notifications.

## Mobile surfaces inspected

- `apps/mobile/app/index.tsx`
- `apps/mobile/src/mobile-destinations.tsx`
- `apps/mobile/src/auth/auth-screen.tsx`
- `apps/mobile/src/auth/mobile-auth-gate.tsx`
- `apps/mobile/src/current-club-context-screen.tsx`
- `apps/mobile/src/team-schedule-screen.tsx`
- `apps/mobile/src/team-roster-screen.tsx`
- `apps/mobile/src/team-game-day-screen.tsx`
- `apps/mobile/src/offline-game-day-view.tsx`
- `apps/mobile/src/team-announcements-screen.tsx`
- `apps/mobile/src/supabase-client.ts`

## Feature/domain evidence

Packages inspected/mapped:
- announcements
- attendance
- club-structure
- coaching-review
- current-club-context
- fill-ins
- fixtures
- game-day
- invitations
- membership
- notifications
- players
- practice-planner
- roster
- schedule
- training
- auth
- permissions
- contracts
- config
- observability

## Database evidence

Migrations reviewed as an implementation inventory from:
- M0 club/profile/membership
- M1 structure, players/guardians, staff/registration, invitations, roster
- M2 fixtures, schedule, Game Day, attendance, training
- M3 announcements, notifications, duties, swaps, fill-ins and remediation
- M4 stats, review, planner, authorization
- M5 audit/private-note hardening

Database test inventory:
- 23 pgTAP files
- recorded M5 evidence: 917 assertions

## Browser acceptance evidence inspected

- `auth-recovery.spec.ts`
- `club-structure.spec.ts`
- `cross-team-denial.spec.ts`
- `guardian-rsvp.spec.ts`
- `invitations.spec.ts`
- `local-auth-club-context.spec.ts`
- `m4-coaching.spec.ts`
- `operations.spec.ts`
- `players.spec.ts`
- `roster.spec.ts`
- `sign-in.spec.ts`
- `team-manager.spec.ts`

## Mobile behavioral evidence inspected

Test coverage inspected across:
- auth screen/gate/session;
- SecureStore session storage;
- current club context;
- destinations;
- schedule;
- roster;
- Game Day;
- offline context;
- announcements.

The important architectural finding is that these tests are high-quality for the surfaces that exist, but missing product journeys (for example native RSVP or real push delivery) cannot reduce code coverage because no implementation exists to be covered.
