# Secrets

Never commit credentials.

Client-safe values may use:

- EXPO_PUBLIC_*
- NEXT_PUBLIC_*

Server secrets must never be exposed through those prefixes.

Production credentials must not be copied into agent prompts, planning
documents, screenshots, tests or fixtures.

Agents may add variable names to `.env.example`.
Agents must never add real secret values.

Service-role / secret Supabase keys are server-only.

Local development should prefer local Supabase.
Preview/staging must not default to production.