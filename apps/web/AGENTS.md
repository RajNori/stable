# Web Admin Agent Instructions

Read root `AGENTS.md`.

## Scope
Next.js Club Admin / coach-manager web.

## Security
Route guards are UX. Data/application authorization remains authoritative.
Never expose server secrets to client bundles.

## UX
Desktop/tablet operational interface, not a stretched mobile app.
Prioritise "Needs Attention" over vanity charts.

## Tests
Playwright for critical admin journeys.
Test capability differences and responsive layouts.

## Deployment
`vercel.json` disables Git deployments for `main` and `master`, and skips a build when `VERCEL_ENV` is `production`. A push does not deploy production.

Preview deployments stay enabled. They must use staging: `NEXT_PUBLIC_APP_ENV=staging` plus the staging Supabase URL and publishable key. Preview must not point at production.

Do not link a Vercel project or run `vercel deploy` from this workstream.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
