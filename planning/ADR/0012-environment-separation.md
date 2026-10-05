# ADR 0012 — Environment Separation
Status: Accepted

## Decision
Local, staging/preview and production are distinct. Staging and production use separate Supabase projects. Preview clients never default to production.

Production mutations require human approval.
