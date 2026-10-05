# Security and Child-Privacy Requirements

## Threat model priorities
1. cross-team/cross-club data leakage;
2. guardian accessing unrelated child data;
3. removed staff retaining access;
4. service-role misuse;
5. insecure invitations/account linking;
6. exposed push/storage tokens;
7. public or guessable child media;
8. over-broad analytics/logging;
9. IDOR through user-supplied IDs;
10. concurrency flaws in swaps/assignments.

## Principles
- deny by default;
- least privilege;
- explicit tenancy;
- server-side authorization;
- RLS defence in depth;
- minimal child data;
- no secrets on clients;
- auditable privileged operations.

## Auth
- Supabase Auth is identity authority.
- Normalize Australian phone numbers to E.164.
- Account linking across phone/email/Apple/Google must be deliberate; never merge solely because names match.
- Handle duplicate emails/phones safely.
- Sessions revoked on logout as supported and membership access revoked immediately through DB state.

## Invitations
- one-time;
- expiring;
- revocable;
- intended identity binding where feasible;
- token stored hashed/opaque;
- replay denied;
- acceptance audited.

## RLS
Enable RLS on all exposed tenant/child tables.
No broad `authenticated can select` policy.
Helper functions used in policies must be carefully permissioned and tested for security-definer behaviour.

## API
- Zod/schema validation at boundaries;
- consistent error mapping;
- no stack traces to clients;
- rate-limit sensitive endpoints where appropriate;
- idempotency for retry-prone commands;
- correlation IDs.

## Storage
MVP does not ship gallery, but storage policies are scaffolded.
Any future child media:
- private bucket;
- signed/time-limited access;
- membership/consent checks;
- generated object keys;
- MIME/size validation;
- no public URL assumption.

## Logging
Never log:
- OTPs;
- auth tokens;
- service keys;
- full push tokens;
- child private notes;
- sensitive absence reasons;
- full request bodies by default.

Use stable opaque IDs.

## Analytics
Do not send:
- child names;
- guardian contact details;
- private notes;
- exact venue attendance history tied to child identity.

Use high-level events.

## Mobile
- no secrets in EXPO_PUBLIC variables;
- secure session storage using platform-recommended secure storage;
- cached Game Day snapshot contains only minimum required team data;
- clear cached private data on logout/account change;
- avoid screenshot-sensitive screens only where truly necessary; do not over-engineer.

## Web
- server/client boundaries explicit;
- protect privileged admin routes for UX, but data/API authorization remains authoritative;
- CSP/security headers considered before production;
- no secret environment values exposed to browser.

## Dependency/security review
CI should include dependency audit/scanning appropriate to the chosen package manager and GitHub security features.

## Required adversarial tests
- IDOR across team IDs;
- IDOR across player IDs;
- revoked coach;
- revoked guardian;
- stale invitation;
- reused invitation;
- service operation with forged club_id;
- race on duty swap acceptance;
- race on fill-in confirmation;
- malformed stats;
- offline stale data not presented as fresh.
