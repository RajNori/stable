# Release Gates

## Pilot release

### Product
- guardian invitation/auth works;
- multiple Mustangs teams supported;
- Game Day complete;
- attendance complete;
- recurring training complete;
- announcements complete;
- notifications complete;
- duties/swaps complete;
- fill-ins complete;
- coach stats/review complete;
- thin practice planner complete;
- Club Admin operational.

### Security
- no unresolved Critical/High;
- capability matrix green;
- RLS matrix green;
- revoked membership tests green;
- service-role operations reviewed;
- invitation abuse tests green;
- storage not public.

### Quality
- numerical coverage gates green;
- critical E2E green;
- no known P0/P1 defect;
- accessibility review complete;
- offline Game Day test complete;
- performance smoke complete.

### Operations
- staging verified;
- Sentry verified;
- backups/config understood;
- production environment separated;
- push credentials verified;
- TestFlight build verified;
- Android internal build verified.

### Human approval
Required before:
- production Supabase migration;
- Vercel production;
- EAS production/store submission.

Production Supabase, Vercel production, and EAS production stay blocked while `planning/security-exceptions/2026-10-05-expo-metro-high-advisories.json` says `productionStatus` is `BLOCKED`. A development audit warning for those two unpatched advisories is not acceptance for a production release. Re-review the exception when an upstream patch is published, when Expo or Metro is upgraded, or before any of those production actions.

## Evidence
Every release candidate produces:
- commit SHA;
- migration list;
- test summary;
- coverage summary;
- known issues;
- security review;
- build identifiers.
