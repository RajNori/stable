# ADR 0006 — Supabase Reads + Explicit Commands
Status: Accepted

## Decision
Clients may make safe RLS-protected reads. Privileged, multi-record, audited, external or concurrency-sensitive mutations use explicit application operations on a trusted boundary.

## Consequence
No arbitrary table CRUD spread through UI components.
