#!/usr/bin/env bash
# Fail when the runner Node or pnpm pin drifts from the repository.
set -eu

expected="$(tr -d '[:space:]' < .nvmrc)"
test "$(node -v)" = "v${expected}"
test "$(node -p 'require("./package.json").engines.node')" = "${expected}"
test "$(node -p 'require("./package.json").packageManager')" = "pnpm@$(pnpm -v)"
