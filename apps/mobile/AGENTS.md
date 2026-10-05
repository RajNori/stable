# Mobile Agent Instructions

Read root `AGENTS.md` first.

## Scope
Expo React Native app for iOS and Android.

## Principles
- Expo Router.
- Accessible mobile-first UX.
- TanStack Query for server state.
- React Hook Form + Zod.
- Zustand only for small local transient state.
- No business rules hidden in components.
- No direct privileged Supabase mutations.
- No service-role credentials.
- Critical Game Day read-only offline snapshot.
- Clear role-capability augmentation: one adult may be parent + coach + manager.
- Default guardian player name presentation: first name + surname initial.

## Tests
Use React Native Testing Library for components and Maestro only for critical E2E.
All primary actions must have accessible labels/roles.

## Design
Do not invent final design tokens before `planning/DESIGN_SYSTEM.md` is approved.
