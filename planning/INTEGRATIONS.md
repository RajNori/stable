# Integrations

## PlayHQ

### Contract
PlayHQ is an external official-data provider, not a domain model.

Use:
`PlayHQ payload -> adapter -> mapper -> internal fixture/result contract`.

No mobile/web feature imports PlayHQ response types.

### V1 before API access
Support `MANUAL` official fixture source and optional safe import pathway.

Required metadata:
- source;
- external_id nullable;
- imported_at/created_at;
- last_synced_at nullable.

### Once API access exists
PlayHQ becomes authoritative for official:
- fixture date/time;
- venue/court if supplied;
- opponent;
- round;
- fixture status;
- result;
- ladder.

Team overlay is never overwritten.

### Reconciliation
Sync must:
- be idempotent;
- detect changes;
- persist sync-run summary;
- emit business event only on meaningful change;
- avoid duplicate fixture creation;
- preserve local overlay;
- handle cancelled/postponed games;
- handle upstream missing/partial data;
- rate-limit/backoff.

### Failure
If PlayHQ fails:
- do not delete local fixtures;
- show last known data;
- record sync error;
- retry safely;
- notify admins only when operationally meaningful.

## Expo Push

Business event -> notification policy -> recipient resolver -> push adapter -> delivery log.

Push is best-effort. Failure does not roll back the source business transaction.

## Sentry
Use per environment.
Scrub personal content.

## PostHog
Use privacy-conscious events only.
No child names/private notes/contact details.

## Future integrations
Any future provider must get its own anti-corruption boundary and ADR.
