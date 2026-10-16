# The Stable — Role Journey, User Story, Gap & Remediation Pack

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


## Purpose

This pack rebuilds The Stable from the user backwards. It defines clear separation of concerns for every role, decomposes each role into epics and implementable user stories, maps those stories against the current repository, and identifies gaps, root causes and remediation required for a real pilot.

## Documents

- `00_IMPLEMENTATION_ARCHITECTURE_GAP_ANALYSIS.md`
- `01_CLUB_ADMIN.md`
- `02_HEAD_COACH.md`
- `03_ASSISTANT_COACH.md`
- `04_TEAM_MANAGER.md`
- `05_PARENT_GUARDIAN.md`
- `06_PLAYER_PARTICIPANT.md`
- `TRACEABILITY_SUMMARY.json`

## Approved target auth split

### Web dashboard
- Google SSO
- Facebook SSO
- Email + password
- Password recovery via single-use recovery link
- Persistent normal session
- Authentication never grants authorization by itself

### Mobile
- SMS OTP is the default/preferred path
- Email is an alternative magic-link/deep-link path
- Supabase Auth remains the identity authority
- Twilio delivers SMS
- SendGrid delivers auth/recovery email
- Players do not authenticate in V1

The current repository does not yet implement this exact split. That is a deliberate target change.

## Product frame

```text
CLUB LOOP
Configure -> Invite -> Govern -> Monitor

OPERATIONS LOOP
Schedule -> RSVP -> Duties -> Fill-ins -> Game Day

COACHING LOOP
Game -> Stats -> Review -> Focus -> Practice

FAMILY LOOP
Know what's next -> Respond -> Show up ready
```

Every loop is constrained by:

```text
Identity
  -> active membership / guardian relationship
  -> contextual capability
  -> RLS / trusted command boundary
  -> privacy
  -> audit
```
