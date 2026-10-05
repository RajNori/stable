# Storage

## MVP
The MVP does not require a public/team gallery. Storage is limited to assets genuinely required by V1.

## Wave 2 child media
- Supabase private buckets;
- generated object paths;
- DB metadata row;
- signed access;
- consent policy;
- moderation state;
- team/club authorization.

Suggested logical path:
`clubs/{clubId}/teams/{teamId}/events/{eventId}/{uuid}`

Never put a child's name in object keys.

## Upload validation
- file size;
- MIME;
- extension/content consistency where practical;
- permitted uploader;
- permitted destination;
- image dimensions if needed.

## Access
Storage policy alone is not the full consent model. Application authorization must consider team access and consent.

## Deletion
Define:
- user-requested deletion;
- expired/removed team access;
- orphan cleanup;
- audit requirements.

Do not implement irreversible bulk deletion without human-approved runbook.
