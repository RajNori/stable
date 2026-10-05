$ErrorActionPreference = "Stop"

try { corepack enable | Out-Null } catch {}

if (Test-Path "pnpm-lock.yaml") {
  pnpm install --frozen-lockfile
} elseif (Test-Path "package.json") {
  pnpm install
}

Write-Host "Worktree ready."
Write-Host "Do not copy production secrets automatically."
Write-Host "Coordinate with the Supabase/Data agent before starting a local Supabase stack in parallel."
