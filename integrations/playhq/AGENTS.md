# PlayHQ Integration Instructions

Treat PlayHQ as external.

- Provider DTOs stay here.
- Map into internal contracts.
- Sync is idempotent.
- Preserve Stable-owned overlay.
- Never delete local data because upstream temporarily omitted it without explicit reconciliation rules.
- Handle rate limit/outage/partial responses.
- Record sync evidence.
