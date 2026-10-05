# ADR 0002 — Supabase Platform
Status: Accepted

## Decision
Use Supabase PostgreSQL, Auth, Storage, Realtime and server-side functions for V1. Vercel hosts the Next.js admin. Expo/EAS ships mobile.

## Guardrail
Do not introduce Redis, Kubernetes, a dedicated NestJS service or queue system without measured need and a new ADR.
