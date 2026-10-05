#!/usr/bin/env bash
set -euo pipefail

corepack enable >/dev/null 2>&1 || true

if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
elif [ -f package.json ]; then
  pnpm install
fi

echo "Worktree ready."
echo "Do not copy production secrets automatically."
echo "Coordinate with the Supabase/Data agent before starting a local Supabase stack in parallel."
