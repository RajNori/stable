#!/usr/bin/env bash
# CI may talk only to the disposable local Supabase stack.
set -eu

if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] ||
  [ -n "${SUPABASE_DB_PASSWORD:-}" ] ||
  [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] ||
  [ -n "${SUPABASE_SECRET_KEY:-}" ] ||
  [ -n "${SECRET_KEY:-}" ] ||
  [ -n "${SERVICE_ROLE_KEY:-}" ]; then
  echo "CI must not receive hosted Supabase credentials."
  exit 1
fi

for url in "${SUPABASE_URL:-}" "${NEXT_PUBLIC_SUPABASE_URL:-}"; do
  case "$url" in
    *supabase.co*)
      echo "CI must not use a hosted Supabase URL."
      exit 1
      ;;
  esac
done

if [ -f supabase/.temp/project-ref ]; then
  echo "CI must not use a linked Supabase project."
  exit 1
fi
